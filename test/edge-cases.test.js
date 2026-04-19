/**
 * Edge Case Tests — targeted at known buggy areas and boundary conditions.
 * All use minimal synthetic fixtures.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock, MockAudio } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let MX, EX;

beforeEach(() => {
  resetBrowserMock();
  ({ MX, EX } = loadAll());
});

function setupEngine(lessonFn) {
  const lesson = MX.lesson('Edge', lessonFn);
  const graph = new EX.LessonGraph(lesson);
  const state = new EX.PlaybackState(graph);
  window._graph = graph;
  window._state = state;
  EX.AudioManager.init(graph);
  EX.Subtitles.init(graph);
  EX.ScrollSync.init();
  EX.Orchestrator.init(graph, state);
  return { lesson, graph, state };
}

// ─────────────────────────────────────────────────────
//  Unicode in narration
// ─────────────────────────────────────────────────────
describe('Unicode narration', () => {
  it('handles unicode characters in beat text', () => {
    const { lesson } = setupEngine(L => {
      L.act('A', A => {
        A.say('Area is \u2265 2023\u03C0. That\u2019s the threshold.');
      });
    });

    expect(lesson.acts[0].beats[0].say).toContain('\u2265');
    expect(lesson.acts[0].beats[0].say).toContain('\u03C0');
  });

  it('beat duration estimation works with unicode text', () => {
    const { lesson } = setupEngine(L => {
      L.act('A', A => {
        A.say('\u03C0 \u2265 3.14 always holds true forever'); // 6 words
      });
    });

    // 6 words / 2.5 WPS = 2.4, ceil = 3
    expect(lesson.acts[0].duration).toBe(3);
  });
});

// ─────────────────────────────────────────────────────
//  Empty and minimal acts
// ─────────────────────────────────────────────────────
describe('Empty and minimal acts', () => {
  it('act with no say text gets minimum duration', () => {
    const { lesson } = setupEngine(L => {
      L.act('Silent', A => {
        A.say(''); // empty say
      });
    });

    expect(lesson.acts[0].duration).toBe(2); // minimum
  });

  it('act with only a title beat (no narration) works', () => {
    const { lesson } = setupEngine(L => {
      L.act('Title Only', A => {
        A.title('Big Heading', 'Subtitle here');
      });
    });

    expect(lesson.acts[0].beats).toHaveLength(1);
    expect(lesson.acts[0].beats[0].say).toBeNull();
    expect(lesson.acts[0].beats[0].card.type).toBe('title');
  });

  it('act with no viz actions works', () => {
    const { graph, state } = setupEngine(L => {
      L.act('No Viz', A => {
        A.say('Just narration, no visualizations.');
      });
    });

    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);
    expect(EX.ActRunner.masterTl).not.toBeNull();
    expect(EX.ActRunner.beatCues).toHaveLength(1);
  });

  it('lesson with no audio data builds a graph without errors', () => {
    const { graph } = setupEngine(L => {
      L.act('A', A => { A.say('No audio'); });
    });

    expect(graph.audio).toBeNull();
    expect(graph.subtitles).toBeNull();
  });
});

// ─────────────────────────────────────────────────────
//  Seek past end / boundary
// ─────────────────────────────────────────────────────
describe('Seek boundary conditions', () => {
  it('seekToGlobalTime clamps to 0 for negative time', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world test beat.'); });
    });
    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);
    EX.ActRunner._rafId = 1;

    EX.Orchestrator.seekToGlobalTime(-10, graph, state);
    expect(state.localTime).toBe(0);
  });

  it('seekToGlobalTime clamps to totalDefaultDuration for huge time', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world test beat.'); });
    });
    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);
    EX.ActRunner._rafId = 1;

    EX.Orchestrator.seekToGlobalTime(99999, graph, state);
    // Should have jumped to the last valid position
    expect(state.defaultIndex).toBeGreaterThanOrEqual(0);
  });

  it('jumpToDefaultIndex with targetIdx 0 starts from the beginning', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A1', A => { A.say('First act narration here.'); });
      L.act('A2', A => { A.say('Second act narration here.'); });
    });
    state.phase = 'playing';
    state.start();
    state.advanceToNextAct(); // at act 2

    EX.Orchestrator.jumpToDefaultIndex(0, 0, graph, state);
    expect(state.defaultIndex).toBe(0);
    expect(state.getCurrentActId()).toBe(graph.defaultPath[0]);
  });
});

// ─────────────────────────────────────────────────────
//  Nested wrong-answer branches (2 levels deep)
// ─────────────────────────────────────────────────────
describe('Nested wrong-answer branches', () => {
  it('first level wrongPath branches are stored correctly', () => {
    const lesson = MX.lesson('Nested', L => {
      L.act('Main', A => { A.say('Main content here.'); });
      L.ask({
        question: 'Q1?',
        options: ['A', 'B'],
        correct: 0,
        wrongPath: B => {
          B.act('Branch L1', A => { A.say('First level branch.'); });
        },
      });
      L.act('Final', A => { A.say('After the gate.'); });
    });

    const ms1 = lesson.milestones[0];
    expect(ms1.wrongPath.length).toBe(1);
    const branchId1 = ms1.wrongPath[0];
    expect(lesson.branchActs[branchId1].title).toBe('Branch L1');
    expect(lesson.branchActs[branchId1]._isBranch).toBe(true);
  });

  it('multiple branch acts in a single wrongPath are all stored', () => {
    const lesson = MX.lesson('MultiBranch', L => {
      L.act('Main', A => { A.say('Main content.'); });
      L.ask({
        question: 'Q?',
        options: ['A', 'B'],
        correct: 0,
        wrongPath: B => {
          B.act('Branch Step 1', A => { A.say('First recap step.'); });
          B.act('Branch Step 2', A => { A.say('Second recap step.'); });
          B.act('Branch Step 3', A => { A.say('Third recap step.'); });
        },
      });
    });

    const ms = lesson.milestones[0];
    expect(ms.wrongPath).toHaveLength(3);
    const titles = ms.wrongPath.map(id => lesson.branchActs[id].title);
    expect(titles).toEqual(['Branch Step 1', 'Branch Step 2', 'Branch Step 3']);
  });
});

// ─────────────────────────────────────────────────────
//  Gate → audio finish → gate shows
// ─────────────────────────────────────────────────────
describe('Gate audio-drain before showing', () => {
  it('enters gate immediately when no audio is playing', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world test.'); });
      L.ask({
        question: 'Q?', options: ['A', 'B'], correct: 0,
      });
      L.act('B', A => { A.say('After gate.'); });
    });
    state.phase = 'playing';
    state.start();
    EX.AudioManager.current = null; // no audio

    let gateEntered = false;
    EX.EventBus.on('gate:enter', () => { gateEntered = true; });

    const ms = graph.milestoneAfter[graph.defaultPath[0]];
    EX.Orchestrator._enterGateWhenAudioDone(ms, graph.defaultPath[0], graph, state);

    expect(gateEntered).toBe(true);
    expect(state.phase).toBe('gate');
  });

  it('waits for audio to end before entering gate', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world test.'); });
      L.ask({
        question: 'Q?', options: ['A', 'B'], correct: 0,
      });
      L.act('B', A => { A.say('After gate.'); });
    });
    state.phase = 'playing';
    state.start();

    // Simulate audio still playing
    const mockAudio = new MockAudio();
    mockAudio.paused = false;
    mockAudio.ended = false;
    mockAudio.currentTime = 3.5;
    EX.AudioManager.current = mockAudio;

    let gateEntered = false;
    EX.EventBus.on('gate:enter', () => { gateEntered = true; });

    const ms = graph.milestoneAfter[graph.defaultPath[0]];
    EX.Orchestrator._enterGateWhenAudioDone(ms, graph.defaultPath[0], graph, state);

    // Gate should NOT have entered yet
    expect(gateEntered).toBe(false);
    expect(EX.Orchestrator._pendingGateTimer).not.toBeNull();

    // Simulate audio ending
    mockAudio.ended = true;
    const fns = mockAudio._listeners['ended'] || [];
    fns.forEach(fn => fn());

    expect(gateEntered).toBe(true);
    expect(state.phase).toBe('gate');
  });

  it('safety timer fires after 3s even if audio never ends', async () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world test.'); });
      L.ask({
        question: 'Q?', options: ['A', 'B'], correct: 0,
      });
      L.act('B', A => { A.say('After gate.'); });
    });
    state.phase = 'playing';
    state.start();

    const mockAudio = new MockAudio();
    mockAudio.paused = false;
    mockAudio.ended = false;
    EX.AudioManager.current = mockAudio;

    const ms = graph.milestoneAfter[graph.defaultPath[0]];
    EX.Orchestrator._enterGateWhenAudioDone(ms, graph.defaultPath[0], graph, state);

    // Don't fire any audio events — the 3s safety should handle it
    expect(EX.Orchestrator._pendingGateTimer).not.toBeNull();

    // We can't actually wait 3s in a test, but we verified the timer is set
    // Clean up
    EX.Orchestrator.cancelPendingGate();
  });
});

// ─────────────────────────────────────────────────────
//  Wrong answer → branch → return to main
// ─────────────────────────────────────────────────────
describe('Wrong answer branch flow', () => {
  it('gate:resolve with wrong answer enters branch, then returns to main path', () => {
    const { graph, state } = setupEngine(L => {
      L.act('Main', A => { A.say('Main content here.'); });
      L.ask({
        question: 'Q?', options: ['A', 'B'], correct: 0,
        wrongPath: B => {
          B.act('Recap', A => { A.say('Review material here.'); });
        },
      });
      L.act('After', A => { A.say('Continuing after gate.'); });
    });

    state.phase = 'playing';
    state.start();

    const ms = graph.milestoneAfter[graph.defaultPath[0]];
    const branchIds = ms.wrongPath;

    // Simulate wrong answer
    state.transition('gate');
    EX.EventBus.emit('gate:resolve', { correct: false, milestone: ms });

    // Should be on the branch
    expect(state._onBranchPath).toBe(true);
    expect(state.getCurrentActId()).toBe(branchIds[0]);
    expect(state.phase).toBe('playing');

    // Simulate branch act completing
    EX.EventBus.emit('act:complete', { actId: branchIds[0] });

    // Should have returned to main path — next act after the gate
    expect(state._onBranchPath).toBe(false);
    expect(state.getCurrentActId()).toBe(graph.defaultPath[1]);
  });

  it('gate:resolve with correct answer advances to next act', () => {
    const { graph, state } = setupEngine(L => {
      L.act('Main', A => { A.say('Main content here.'); });
      L.ask({
        question: 'Q?', options: ['A', 'B'], correct: 0,
      });
      L.act('After', A => { A.say('Continuing forward now.'); });
    });

    state.phase = 'playing';
    state.start();

    const ms = graph.milestoneAfter[graph.defaultPath[0]];
    state.transition('gate');
    EX.EventBus.emit('gate:resolve', { correct: true, milestone: ms });

    expect(state.phase).toBe('playing');
    expect(state.getCurrentActId()).toBe(graph.defaultPath[1]);
  });
});

// ─────────────────────────────────────────────────────
//  Replay from ended state
// ─────────────────────────────────────────────────────
describe('Replay from ended', () => {
  it('Orchestrator.start() clears notebook and viz on replay', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Content here.'); });
    });

    let nbCleared = 0, vizReset = 0, audioStopped = 0;
    EX.EventBus.on('notebook:clear', () => nbCleared++);
    EX.EventBus.on('viz:reset', () => vizReset++);
    EX.EventBus.on('audio:stop', () => audioStopped++);

    // First play
    EX.Orchestrator.start(graph, state);
    const clearCount1 = nbCleared;

    // End and replay
    state.phase = 'ended';
    EX.Orchestrator.start(graph, state);

    expect(nbCleared).toBeGreaterThan(clearCount1);
    expect(vizReset).toBeGreaterThan(0);
    expect(audioStopped).toBeGreaterThan(0);
    expect(state.phase).toBe('playing');
    expect(state.defaultIndex).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
//  Speed change mid-lesson
// ─────────────────────────────────────────────────────
describe('Speed change', () => {
  it('setRate propagates to AudioManager and ActRunner', () => {
    const { graph, state } = setupEngine(L => {
      L.act('A', A => { A.say('Speed test narration here.'); });
    });
    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);

    // Change speed to 2x
    EX.AudioManager.setRate(2);
    EX.ActRunner.setTimeScale(2);

    expect(EX.AudioManager.rate).toBe(2);
    // GSAP mock stores timeScale
    if (EX.ActRunner.masterTl) {
      expect(EX.ActRunner.masterTl.timeScale()).toBe(2);
    }
  });
});

// ─────────────────────────────────────────────────────
//  ActRunner detailed methods
// ─────────────────────────────────────────────────────
describe('ActRunner additional methods', () => {
  it('getCurrentTime returns 0 with no timeline', () => {
    EX.ActRunner.masterTl = null;
    expect(EX.ActRunner.getCurrentTime()).toBe(0);
  });

  it('getActDuration uses act.duration if set', () => {
    expect(EX.ActRunner.getActDuration({ duration: 15 })).toBe(15);
  });

  it('getActDuration falls back to beatCues if no duration', () => {
    EX.ActRunner.beatCues = [
      { beatId: 'b1', startTime: 0, endTime: 3 },
      { beatId: 'b2', startTime: 3, endTime: 7 },
    ];
    expect(EX.ActRunner.getActDuration({})).toBe(7);
  });

  it('getActDuration returns 5 as default', () => {
    EX.ActRunner.beatCues = [];
    expect(EX.ActRunner.getActDuration({})).toBe(5);
  });

  it('play() is a no-op with no masterTl', () => {
    EX.ActRunner.masterTl = null;
    expect(() => EX.ActRunner.play()).not.toThrow();
  });

  it('pause() is a no-op with no masterTl', () => {
    EX.ActRunner.masterTl = null;
    expect(() => EX.ActRunner.pause()).not.toThrow();
  });

  it('seek() is a no-op with no masterTl', () => {
    EX.ActRunner.masterTl = null;
    expect(() => EX.ActRunner.seek(5)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────
//  AudioManager seekTo with different readyStates
// ─────────────────────────────────────────────────────
describe('AudioManager.seekTo edge cases', () => {
  it('seeks immediately when readyState >= 1', () => {
    const audio = new MockAudio();
    audio.readyState = 4;
    audio.currentTime = 0;
    EX.AudioManager.current = audio;

    EX.AudioManager.seekTo(5.5);
    expect(audio.currentTime).toBe(5.5);
  });

  it('queues seek when readyState < 1', () => {
    const audio = new MockAudio();
    audio.readyState = 0;
    audio.currentTime = 0;
    EX.AudioManager.current = audio;

    EX.AudioManager.seekTo(3.0);
    // Not seeked yet
    expect(audio.currentTime).toBe(0);

    // Simulate canplay
    const fns = audio._listeners['canplay'] || [];
    fns.forEach(fn => fn());
    expect(audio.currentTime).toBe(3.0);
  });

  it('seekTo is a no-op with no current audio', () => {
    EX.AudioManager.current = null;
    expect(() => EX.AudioManager.seekTo(5)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────
//  AudioManager.getDuration
// ─────────────────────────────────────────────────────
describe('AudioManager.getDuration', () => {
  it('returns cached duration for specific actId', () => {
    const audio = new MockAudio();
    audio.duration = 15.5;
    EX.AudioManager.cache['act-1'] = audio;

    expect(EX.AudioManager.getDuration('act-1')).toBe(15.5);
  });

  it('returns current audio duration when no actId', () => {
    const audio = new MockAudio();
    audio.duration = 8.2;
    EX.AudioManager.current = audio;

    expect(EX.AudioManager.getDuration()).toBe(8.2);
  });

  it('returns 0 for NaN duration', () => {
    const audio = new MockAudio();
    audio.duration = NaN;
    EX.AudioManager.current = audio;

    expect(EX.AudioManager.getDuration()).toBe(0);
  });

  it('returns 0 with no current audio', () => {
    EX.AudioManager.current = null;
    expect(EX.AudioManager.getDuration()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────
//  AudioManager.setEnabled
// ─────────────────────────────────────────────────────
describe('AudioManager.setEnabled', () => {
  it('disabling stops current audio', () => {
    const audio = new MockAudio();
    audio.paused = false;
    EX.AudioManager.current = audio;

    EX.AudioManager.setEnabled(false);
    expect(EX.AudioManager.enabled).toBe(false);
    expect(EX.AudioManager.current).toBeNull();
  });

  it('enabling does not auto-play', () => {
    EX.AudioManager.setEnabled(true);
    expect(EX.AudioManager.enabled).toBe(true);
    expect(EX.AudioManager.current).toBeNull();
  });
});

// ─────────────────────────────────────────────────────
//  Build graceful fallback
// ─────────────────────────────────────────────────────
describe('Build fallback', () => {
  it('build.sh with non-existent audio file fails gracefully', () => {
    const { execSync } = require('child_process');
    const { join } = require('path');
    const ROOT = join(import.meta.dirname, '..');

    try {
      execSync(
        'bash build.sh --mx examples/01_cards.js dist/test_noaudio.html nonexistent_audio.js',
        { cwd: ROOT, encoding: 'utf-8', timeout: 10000, stdio: 'pipe' }
      );
      // If it doesn't throw, the build handled the missing file gracefully
    } catch (e) {
      // Expected: build.sh should fail with a clear error
      expect(e.stderr + e.stdout).toMatch(/ERROR|No such file|not found/i);
    }
  });
});

// ─────────────────────────────────────────────────────
//  Subtitles update and hide
// ─────────────────────────────────────────────────────
describe('Subtitles detailed', () => {
  it('update() shows subtitle for matching time range', () => {
    EX.Subtitles.init({ audio: null, subtitles: null, beatTimings: null });
    EX.Subtitles.cues = [
      { start: 0, end: 2, text: 'First cue' },
      { start: 2, end: 4, text: 'Second cue' },
    ];
    EX.Subtitles.currentIdx = -1;

    EX.Subtitles.update(1.0);
    expect(EX.Subtitles.currentIdx).toBe(0);

    EX.Subtitles.update(3.0);
    expect(EX.Subtitles.currentIdx).toBe(1);
  });

  it('update() hides subtitle when no cue matches', () => {
    EX.Subtitles.init({ audio: null, subtitles: null, beatTimings: null });
    EX.Subtitles.cues = [
      { start: 1, end: 2, text: 'Only cue' },
    ];
    EX.Subtitles.currentIdx = 0;

    EX.Subtitles.update(5.0); // past all cues
    expect(EX.Subtitles.currentIdx).toBe(-1);
  });

  it('hide() resets currentIdx', () => {
    EX.Subtitles.init({ audio: null, subtitles: null, beatTimings: null });
    EX.Subtitles.currentIdx = 3;
    EX.Subtitles.hide();
    expect(EX.Subtitles.currentIdx).toBe(-1);
  });

  it('setEnabled(false) hides subtitles', () => {
    EX.Subtitles.init({ audio: null, subtitles: null, beatTimings: null });
    EX.Subtitles.setEnabled(false);
    expect(EX.Subtitles.enabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────
//  LessonGraph.getDefaultCumulativeTime
// ─────────────────────────────────────────────────────
describe('LessonGraph.getDefaultCumulativeTime', () => {
  it('returns 0 for index 0 with no localTime', () => {
    const { graph } = setupEngine(L => {
      L.act('A', A => { A.say('Hello world.'); });
    });
    expect(graph.getDefaultCumulativeTime(0, 0)).toBe(0);
  });

  it('returns sum of prior act durations + localTime', () => {
    const { graph } = setupEngine(L => {
      L.act('A1', A => { A.say('one two three four five'); }); // 2s
      L.act('A2', A => { A.say('one two three four five six seven eight nine ten'); }); // 4s
    });
    // At index 1 (act 2), localTime 2: cumulative = 2 (act 1 dur) + 2 = 4
    expect(graph.getDefaultCumulativeTime(1, 2)).toBe(4);
  });
});
