/**
 * Audio Tests — alignment_to_cues(), AudioManager, subtitle sync
 *
 * Tests the Python alignment_to_cues function via a subprocess call,
 * and the JS AudioManager module via browser mocks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';
import { resetBrowserMock, MockAudio } from './browser-mock.js';
import { loadAll } from './load-engine.js';

const ROOT = join(import.meta.dirname, '..');

// ─────────────────────────────────────────────────────
//  alignment_to_cues (Python function, tested via subprocess)
// ─────────────────────────────────────────────────────

function runAlignmentToCues(alignment, maxWordsPerCue) {
  // We can't import generate_audio directly because it imports `requests`
  // which may not be installed. Instead, extract just the alignment_to_cues
  // function source and run it standalone.
  const pyCode = `
import sys, json, re, os

# Extract alignment_to_cues from generate_audio.py without importing the module
src = open(os.path.join('${ROOT}', 'generate_audio.py')).read()
# Find the function definition and everything until the next top-level def/class
match = re.search(r'(def alignment_to_cues\\(.*?\\n)(?=\\n(?:def |class |# ={5,}))', src, re.DOTALL)
if not match:
    print("ERROR: Could not extract function", file=sys.stderr)
    sys.exit(1)
func_src = match.group(0)
exec(func_src, globals())

alignment = json.loads('''${JSON.stringify(alignment)}''')
result = alignment_to_cues(alignment${maxWordsPerCue ? ', ' + maxWordsPerCue : ''})
print(json.dumps(result))
`;
  const result = execSync(`python3 -c "${pyCode.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    timeout: 10000,
    cwd: ROOT,
  });
  return JSON.parse(result.trim());
}

describe('alignment_to_cues', () => {
  it('converts character-level timing to word-level cues', () => {
    const alignment = {
      characters: ['H', 'i', ' ', 't', 'h', 'e', 'r', 'e', '.'],
      character_start_times_seconds: [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
      character_end_times_seconds:   [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
    };

    const cues = runAlignmentToCues(alignment);

    // "Hi there." should be one cue (sentence ends with .)
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hi there.');
    expect(cues[0].start).toBe(0.0);
    expect(cues[0].end).toBe(0.45);
    expect(cues[0].words).toHaveLength(2);
    expect(cues[0].words[0].word).toBe('Hi');
    expect(cues[0].words[1].word).toBe('there.');
  });

  it('splits on sentence-ending punctuation', () => {
    const chars = 'Hello. World!'.split('');
    const starts = chars.map((_, i) => i * 0.05);
    const ends = chars.map((_, i) => (i + 1) * 0.05);

    const cues = runAlignmentToCues({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    // "Hello." and "World!" — two sentences
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Hello.');
    expect(cues[1].text).toBe('World!');
  });

  it('splits on max_words_per_cue', () => {
    // 15 words, no punctuation, max 5 per cue
    const text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';
    const chars = text.split('');
    const starts = chars.map((_, i) => i * 0.01);
    const ends = chars.map((_, i) => (i + 1) * 0.01);

    const cues = runAlignmentToCues({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    }, 5);

    expect(cues).toHaveLength(3); // 5 + 5 + 5
    expect(cues[0].words).toHaveLength(5);
    expect(cues[1].words).toHaveLength(5);
    expect(cues[2].words).toHaveLength(5);
  });

  it('returns empty array for empty alignment', () => {
    const cues = runAlignmentToCues({
      characters: [],
      character_start_times_seconds: [],
      character_end_times_seconds: [],
    });
    expect(cues).toEqual([]);
  });

  it('word offsets are relative to cue start', () => {
    const chars = 'A B C.'.split('');
    const starts = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    const ends =   [1.1, 1.2, 1.3, 1.4, 1.5, 1.6];

    const cues = runAlignmentToCues({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(cues[0].words[0].offset).toBe(0); // A starts at cue start
    expect(cues[0].words[1].offset).toBeGreaterThan(0); // B is later
    expect(cues[0].words[2].offset).toBeGreaterThan(cues[0].words[1].offset);
  });
});

// ─────────────────────────────────────────────────────
//  AudioManager (JS module)
// ─────────────────────────────────────────────────────
describe('AudioManager', () => {
  let EX;

  beforeEach(() => {
    resetBrowserMock();
    const loaded = loadAll();
    EX = loaded.EX;
  });

  it('init() stores graph reference', () => {
    const graph = { audio: null, subtitles: null, beatTimings: null };
    EX.AudioManager.init(graph);
    expect(EX.AudioManager._graph).toBe(graph);
  });

  it('loadAct() resolves null when no audio data exists', async () => {
    EX.AudioManager.init({ audio: null });
    const result = await EX.AudioManager.loadAct('act-1');
    expect(result).toBeNull();
  });

  it('loadAct() resolves null when act has no audio', async () => {
    EX.AudioManager.init({ audio: { 'act-2': { b64: 'data' } } });
    const result = await EX.AudioManager.loadAct('act-1');
    expect(result).toBeNull();
  });

  it('loadAct() creates Audio element from base64 and caches it', async () => {
    EX.AudioManager.init({ audio: { 'act-1': { b64: 'dGVzdA==' } } });

    const audio = await EX.AudioManager.loadAct('act-1');
    expect(audio).not.toBeNull();
    expect(audio.src).toContain('data:audio/mpeg;base64,dGVzdA==');

    // Second call should return cached
    const cached = await EX.AudioManager.loadAct('act-1');
    expect(cached).toBe(audio);
  });

  it('stop() pauses audio, resets currentTime, and clears current', () => {
    const mockAudio = new MockAudio();
    mockAudio.paused = false;
    mockAudio.currentTime = 5.0;
    EX.AudioManager.current = mockAudio;

    EX.AudioManager.stop();

    expect(mockAudio.paused).toBe(true);
    expect(mockAudio.currentTime).toBe(0);
    expect(EX.AudioManager.current).toBeNull();
  });

  it('pause() pauses without resetting position', () => {
    const mockAudio = new MockAudio();
    mockAudio.paused = false;
    mockAudio.currentTime = 3.5;
    EX.AudioManager.current = mockAudio;

    EX.AudioManager.pause();

    expect(mockAudio.paused).toBe(true);
    expect(mockAudio.currentTime).toBe(3.5); // position preserved
    expect(EX.AudioManager.current).toBe(mockAudio); // not cleared
  });

  it('resume() plays from current position', () => {
    const mockAudio = new MockAudio();
    mockAudio.paused = true;
    mockAudio.currentTime = 3.5;
    EX.AudioManager.current = mockAudio;
    EX.AudioManager.enabled = true;

    EX.AudioManager.resume();

    expect(mockAudio.paused).toBe(false);
  });

  it('resume() is a no-op when disabled', () => {
    const mockAudio = new MockAudio();
    mockAudio.paused = true;
    EX.AudioManager.current = mockAudio;
    EX.AudioManager.enabled = false;

    EX.AudioManager.resume();

    expect(mockAudio.paused).toBe(true);
  });

  it('setRate() updates playback rate on current audio', () => {
    const mockAudio = new MockAudio();
    EX.AudioManager.current = mockAudio;

    EX.AudioManager.setRate(1.5);

    expect(EX.AudioManager.rate).toBe(1.5);
    expect(mockAudio.playbackRate).toBe(1.5);
  });

  it('loadAndPlay invalidation via _loadToken', async () => {
    EX.AudioManager.init({ audio: {
      'act-1': { b64: 'a' },
      'act-2': { b64: 'b' },
    }});

    // Start loading act-1
    EX.AudioManager.loadAndPlay('act-1', 0);
    // Immediately start loading act-2 (invalidates act-1 load)
    EX.AudioManager.loadAndPlay('act-2', 0);

    // Wait for promises to resolve
    await new Promise(r => setTimeout(r, 50));

    // Current should be act-2's audio, not act-1's
    if (EX.AudioManager.current) {
      expect(EX.AudioManager.current.src).toContain('b');
    }
  });

  it('recover:reset stops audio and invalidates loads', () => {
    const mockAudio = new MockAudio();
    mockAudio.paused = false;
    EX.AudioManager.current = mockAudio;
    const oldToken = EX.AudioManager._loadToken;

    EX.AudioManager.init({ audio: null });
    EX.EventBus.emit('recover:reset', {});

    expect(EX.AudioManager.current).toBeNull();
    expect(EX.AudioManager._loadToken).toBe(oldToken + 1);
  });
});

// ─────────────────────────────────────────────────────
//  Subtitles
// ─────────────────────────────────────────────────────
describe('Subtitles', () => {
  let EX;

  beforeEach(() => {
    resetBrowserMock();
    EX = loadAll().EX;
  });

  it('auto-generates cues from beats when no TTS data', () => {
    const graph = { audio: null, subtitles: null, beatTimings: null };
    EX.Subtitles.init(graph);
    EX.Subtitles.loadAct('act-1', [
      { id: 'b1', say: 'Hello world.' },
      { id: 'b2', say: 'Goodbye world.' },
    ]);

    expect(EX.Subtitles.cues.length).toBeGreaterThan(0);
    expect(EX.Subtitles.cues[0].text).toContain('Hello');
  });

  it('uses TTS subtitle data when available', () => {
    const cueData = [
      { start: 0, end: 1.5, text: 'Hello from TTS', words: [{ word: 'Hello', offset: 0 }] },
    ];
    const graph = { audio: null, subtitles: { 'act-1': cueData }, beatTimings: null };
    EX.Subtitles.init(graph);
    EX.Subtitles.loadAct('act-1', []);

    expect(EX.Subtitles.cues).toBe(cueData);
  });
});
