#!/usr/bin/env python3
"""Generate TTS audio + word-aligned subtitles for a math explainer lesson.

Uses ElevenLabs /v1/text-to-speech/{voice_id}/with-timestamps to produce
audio (base64 MP3) and character-level timing, then converts to word-level
subtitle cues compatible with the explainer engine.

Usage:
  export ELEVENLABS_API_KEY=your_key_here
  python3 generate_audio.py [content_js] [--voice VOICE_ID] [--model MODEL_ID] [--no-cache]

Output:
  content/audio_<lesson_id>.js   — JS file setting L.audio + L.subtitles
  audio_cache/<hash>.json        — cached API responses (one per slide)
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time

import requests

# ── Defaults ──────────────────────────────────────────────────────────────
DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"        # Adam — clear male narration
DEFAULT_MODEL = "eleven_multilingual_v2"
API_BASE = "https://api.elevenlabs.io/v1/text-to-speech"
CACHE_DIR = os.path.join(os.path.dirname(__file__), "audio_cache")
VOICE_SETTINGS = {
    "stability": 0.6,
    "similarity_boost": 0.75,
    "style": 0.1,
    "use_speaker_boost": True,
}


# ═════════════════════════════════════════════════════════════════════════
#  Step 1: Extract scripts from content JS via Node.js
# ═════════════════════════════════════════════════════════════════════════

NODE_EXTRACT = r"""
global.window = {};
global.document = { getElementById: function() { return null; }, createElement: function() { return { style: {}, setAttribute: function(){}, appendChild: function(){}, classList: { add: function(){}, remove: function(){} } }; }, createElementNS: function() { return { setAttribute: function(){}, appendChild: function(){} }; }, addEventListener: function() {}, querySelector: function() { return null; }, querySelectorAll: function() { return []; } };
global.gsap = { timeline: function(){ return { to:function(){return this}, fromTo:function(){return this}, call:function(){return this}, set:function(){return this}, eventCallback:function(){return this}, play:function(){}, pause:function(){}, time:function(){return 0}, duration:function(){return 0}, progress:function(){return 0}, kill:function(){}, timeScale:function(){} }; }, to:function(){}, fromTo:function(){}, set:function(){}, registerPlugin:function(){} };
global.katex = { render: function(){} };
var fs = require('fs');
var path = require('path');

// Load MX modules (mobject, anim, dsl) from same directory as content
var baseDir = path.dirname(process.argv[1]) + '/..';
var mxFiles = ['explainer-mobject.js', 'explainer-anim.js', 'explainer-dsl.js'];
mxFiles.forEach(function(f) {
    var p = path.join(baseDir, f);
    if (fs.existsSync(p)) eval(fs.readFileSync(p, 'utf-8'));
});

// Minimal MX stub for v3 content files that use MX.lesson() DSL.
// Only needed when the full explainer-*.js files are not present.
if (!global.MX) {
  var _actN = 0, _beatN = 0;
  function noop() { return this; }
  function chainable() { return { do: chainable, show: chainable, title: chainable,
    card: chainable, inline: chainable, highlight: chainable, pause: chainable }; }
  function ActBuilder(title) { this.id = 'act-' + (++_actN); this.title = title; this._beats = []; }
  ActBuilder.prototype.vizPanel = noop;
  ActBuilder.prototype.say = function(text) {
    var b = { id: 'b' + (++_beatN), say: text };
    this._beats.push(b);
    return { do: chainable, show: chainable, title: chainable,
      card: chainable, inline: chainable, highlight: chainable, pause: chainable };
  };
  ActBuilder.prototype.marker = noop;

  function BranchBuilder() { this.acts = []; }
  BranchBuilder.prototype.act = function(title, fn) {
    var ab = new ActBuilder(title);
    fn(ab);
    this.acts.push({ id: ab.id, title: title, beats: ab._beats });
  };
  BranchBuilder.prototype.ask = function(opts) {
    if (opts && typeof opts.wrongPath === 'function') {
      var bb = new BranchBuilder();
      opts.wrongPath(bb);
      bb.acts.forEach(function(a) { this.acts.push(a); }.bind(this));
    }
  };
  BranchBuilder.prototype.askFillIn = function(opts) {
    if (opts && typeof opts.wrongPath === 'function') {
      var bb = new BranchBuilder();
      opts.wrongPath(bb);
      bb.acts.forEach(function(a) { this.acts.push(a); }.bind(this));
    }
  };

  function LessonBuilder(title) {
    this._title = title; this._source = ''; this._meta = {};
    this._acts = []; this._branchActs = {};
  }
  LessonBuilder.prototype.source = function(s) { this._source = s; };
  LessonBuilder.prototype.meta = function(m) { Object.assign(this._meta, m); };
  LessonBuilder.prototype.problem = function() {};
  LessonBuilder.prototype.viz = function() {};
  LessonBuilder.prototype.marker = function() {};
  LessonBuilder.prototype.act = function(title, fn) {
    var ab = new ActBuilder(title);
    fn(ab);
    this._acts.push({ id: ab.id, title: title, beats: ab._beats });
  };
  LessonBuilder.prototype.ask = function(opts) {
    if (opts && typeof opts.wrongPath === 'function') {
      var bb = new BranchBuilder();
      opts.wrongPath(bb);
      bb.acts.forEach(function(a) { this._branchActs[a.id] = a; }.bind(this));
    }
  };
  LessonBuilder.prototype.askFillIn = function(opts) {
    if (opts && typeof opts.wrongPath === 'function') {
      var bb = new BranchBuilder();
      opts.wrongPath(bb);
      bb.acts.forEach(function(a) { this._branchActs[a.id] = a; }.bind(this));
    }
  };
  LessonBuilder.prototype.build = function() {
    var WPS = 2.5;
    function estimateDuration(acts) {
      (Array.isArray(acts) ? acts : Object.values(acts)).forEach(function(act) {
        if (act.duration) return;
        var totalWords = 0;
        act.beats.forEach(function(b) { if (b.say) totalWords += b.say.split(/\s+/).length; });
        act.duration = Math.max(2, Math.ceil(totalWords / WPS));
      });
    }
    estimateDuration(this._acts);
    estimateDuration(this._branchActs);
    var lesson = {
      meta: Object.assign({
        id: this._title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        title: this._title, source: this._source
      }, this._meta),
      acts: this._acts,
      branchActs: this._branchActs
    };
    window.LESSON = lesson;
    return lesson;
  };

  global.MX = window.MX = { C: {} };
  MX.lesson = function(title, fn) {
    var b = new LessonBuilder(title);
    fn(b);
    return b.build();
  };
}

// Load content file
eval(fs.readFileSync(process.argv[1], 'utf-8'));

var L = window.LESSON;

// Support both v2 (slides) and v3 (acts) formats
if (L.acts) {
    // v3 Act/Beat format
    var out = { lessonId: L.meta.id, format: "v3", acts: [] };
    function processAct(act) {
        var fullScript = act.beats.map(function(b) { return b.say || ''; }).filter(Boolean).join(' ');
        if (fullScript) {
            out.acts.push({
                actId: act.id,
                title: act.title,
                script: fullScript,
                duration: act.duration || null,
                beatScripts: act.beats.map(function(b) {
                    return { beatId: b.id, say: b.say || '', wordCount: (b.say || '').split(/\s+/).filter(Boolean).length };
                })
            });
        }
    }
    L.acts.forEach(processAct);
    for (var key in (L.branchActs || {})) processAct(L.branchActs[key]);
    process.stdout.write(JSON.stringify(out));
} else if (L.slides) {
    // v2 Slide format (backwards compatible)
    var out = { lessonId: L.meta.id, format: "v2", slides: [] };
    var seen = {};
    function addSlide(id) {
        if (seen[id] || !L.slides[id]) return;
        seen[id] = true;
        var s = L.slides[id];
        if (s.script) {
            out.slides.push({ slideId: id, script: s.script, duration: s.duration || 10 });
        }
    }
    if (L.defaultPath) L.defaultPath.forEach(addSlide);
    Object.keys(L.slides).forEach(addSlide);
    process.stdout.write(JSON.stringify(out));
} else {
    process.stderr.write('ERROR: No acts or slides found in LESSON\n');
    process.exit(1);
}
"""


def extract_scripts(content_path):
    """Run Node.js to eval the content file and extract scripts."""
    try:
        result = subprocess.run(
            ["node", "-e", NODE_EXTRACT, content_path],
            capture_output=True, text=True, timeout=10,
        )
    except FileNotFoundError:
        print("ERROR: Node.js not found. Install Node or use --scripts-json.", file=sys.stderr)
        sys.exit(1)

    if result.returncode != 0:
        print(f"ERROR: Node.js extraction failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    return json.loads(result.stdout)


# ═════════════════════════════════════════════════════════════════════════
#  Step 2: Call ElevenLabs TTS with timestamps
# ═════════════════════════════════════════════════════════════════════════

def text_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def call_tts(text, api_key, voice_id, model_id, cache_path):
    """POST to ElevenLabs with-timestamps. Returns {audio_base64, alignment}."""
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            return json.load(f)

    url = f"{API_BASE}/{voice_id}/with-timestamps"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    body = {
        "text": text,
        "model_id": model_id,
        "voice_settings": VOICE_SETTINGS,
    }

    resp = requests.post(url, headers=headers, json=body, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"ElevenLabs API error {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    # Cache the raw response
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as f:
        json.dump(data, f)

    return data


# ═════════════════════════════════════════════════════════════════════════
#  Step 3: Convert character alignment → word-level subtitle cues
# ═════════════════════════════════════════════════════════════════════════

def alignment_to_cues(alignment, max_words_per_cue=10):
    """Convert character-level timing into word-level subtitle cues.

    Returns list of:
      {start, end, text, words: [{word, offset}, ...]}
    """
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])

    if not chars:
        return []

    # ── Build word list ──
    words = []
    current_word = ""
    word_start = 0.0
    word_end = 0.0

    for i, ch in enumerate(chars):
        if ch in (" ", "\n", "\t"):
            if current_word:
                words.append({
                    "word": current_word,
                    "start": word_start,
                    "end": word_end,
                })
                current_word = ""
        else:
            if not current_word:
                word_start = starts[i] if i < len(starts) else word_end
            current_word += ch
            word_end = ends[i] if i < len(ends) else word_start

    # Flush last word
    if current_word:
        words.append({"word": current_word, "start": word_start, "end": word_end})

    if not words:
        return []

    # ── Group into cues (split on sentence boundaries or max_words) ──
    cues = []
    cue_words = []

    def flush_cue():
        if not cue_words:
            return
        cue_start = cue_words[0]["start"]
        cue_end = cue_words[-1]["end"]
        cue_text = " ".join(w["word"] for w in cue_words)
        cues.append({
            "start": round(cue_start, 3),
            "end": round(cue_end, 3),
            "text": cue_text,
            "words": [
                {"word": w["word"], "offset": round(w["start"] - cue_start, 3)}
                for w in cue_words
            ],
        })

    for w in words:
        cue_words.append(w)
        # Split on sentence-ending punctuation or max words
        is_sentence_end = w["word"].rstrip() and w["word"].rstrip()[-1] in ".!?;"
        if is_sentence_end or len(cue_words) >= max_words_per_cue:
            flush_cue()
            cue_words = []

    flush_cue()
    return cues


# ═════════════════════════════════════════════════════════════════════════
#  Step 4: Write output JS file
# ═════════════════════════════════════════════════════════════════════════

def write_audio_js(lesson_id, audio_map, subtitle_map, output_path, beat_timings=None):
    """Write the JS file that injects audio + subtitles into window.LESSON."""
    lines = [
        "/* Auto-generated TTS audio + subtitles — do not edit manually */",
        "(function() {",
        "var L = window.LESSON;",
        "",
        "L.audio = {",
    ]

    for key, b64 in audio_map.items():
        lines.append(f'  "{key}": {{ b64: "{b64}" }},')

    lines += [
        "};",
        "",
        "L.subtitles = " + json.dumps(subtitle_map, indent=2) + ";",
    ]

    if beat_timings:
        lines += [
            "",
            "L.beatTimings = " + json.dumps(beat_timings, indent=2) + ";",
        ]

    lines += [
        "",
        "})();",
        "",
    ]

    with open(output_path, "w") as f:
        f.write("\n".join(lines))


# ═════════════════════════════════════════════════════════════════════════
#  Main
# ═════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Generate TTS audio for math explainer")
    parser.add_argument("content_js", nargs="?",
                        default="content/amc10a_2023_p15.js",
                        help="Path to the content JS file")
    parser.add_argument("--voice", default=DEFAULT_VOICE,
                        help=f"ElevenLabs voice ID (default: {DEFAULT_VOICE})")
    parser.add_argument("--model", default=DEFAULT_MODEL,
                        help=f"ElevenLabs model ID (default: {DEFAULT_MODEL})")
    parser.add_argument("--no-cache", action="store_true",
                        help="Force regeneration, ignoring cache")
    parser.add_argument("--dry-run", action="store_true",
                        help="Extract and print scripts without calling API")
    args = parser.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not api_key and not args.dry_run:
        print("ERROR: Set ELEVENLABS_API_KEY environment variable.", file=sys.stderr)
        sys.exit(1)

    content_path = os.path.abspath(args.content_js)
    if not os.path.exists(content_path):
        print(f"ERROR: Content file not found: {content_path}", file=sys.stderr)
        sys.exit(1)

    # ── Extract scripts ──
    print(f"Extracting scripts from {args.content_js} ...")
    data = extract_scripts(content_path)
    lesson_id = data["lessonId"]
    fmt = data.get("format", "v2")

    if fmt == "v3":
        acts = data["acts"]
        print(f"  Found {len(acts)} acts with narration (v3 format)")
    else:
        # Legacy v2 slide format
        acts = [{"actId": s["slideId"], "script": s["script"],
                 "duration": s.get("duration", 10), "beatScripts": []}
                for s in data.get("slides", [])]
        print(f"  Found {len(acts)} slides with narration (v2 format)")

    if args.dry_run:
        print("\n=== DRY RUN — Scripts to generate ===")
        for a in acts:
            chars = len(a["script"])
            label = a.get("title", a["actId"])
            beats = len(a.get("beatScripts", []))
            print(f'  [{a["actId"]}] "{label}" ({chars} chars, {beats} beats) {a["script"][:80]}...')
        total_chars = sum(len(a["script"]) for a in acts)
        print(f"\nTotal: {total_chars} characters across {len(acts)} acts")
        return

    # ── Generate audio for each act ──
    os.makedirs(CACHE_DIR, exist_ok=True)
    audio_map = {}       # actId → base64
    subtitle_map = {}    # actId → [cue, ...]
    beat_timings = {}    # actId → [{beatId, startTime, endTime}, ...]
    total_duration = 0.0

    for i, act in enumerate(acts):
        aid = act["actId"]
        script = act["script"]
        h = text_hash(script)
        cache_path = os.path.join(CACHE_DIR, f"{h}.json")
        cached = os.path.exists(cache_path) and not args.no_cache

        print(f"  [{i+1}/{len(acts)}] {aid} {'(cached)' if cached else '(generating...)'}")

        if args.no_cache and os.path.exists(cache_path):
            os.remove(cache_path)

        try:
            result = call_tts(script, api_key, args.voice, args.model, cache_path)
        except Exception as e:
            print(f"    ERROR: {e}", file=sys.stderr)
            continue

        audio_b64 = result.get("audio_base64", "")
        alignment = result.get("alignment") or result.get("normalized_alignment") or {}

        audio_map[aid] = audio_b64

        # Convert alignment to subtitle cues
        cues = alignment_to_cues(alignment)
        if cues:
            subtitle_map[aid] = cues
            act_dur = cues[-1]["end"] if cues else 0
            total_duration += act_dur
            print(f"    → {len(cues)} cues, {act_dur:.1f}s audio")
        else:
            # Fallback: generate simple cues from script text
            dur = act.get("duration") or 10
            sentences = re.split(r'(?<=[.!?])\s+', script)
            t_per = dur / max(len(sentences), 1)
            subtitle_map[aid] = [
                {"start": round(j * t_per, 3), "end": round((j+1) * t_per, 3),
                 "text": s.strip(), "words": []}
                for j, s in enumerate(sentences) if s.strip()
            ]
            act_dur = dur
            print(f"    → fallback subtitles ({len(sentences)} sentences)")

        # Build beat timings by splitting word alignment across beats
        beat_scripts = act.get("beatScripts", [])
        if beat_scripts and cues:
            # Collect all words from cues into a flat list
            all_words = []
            for cue in cues:
                for w in cue.get("words", []):
                    all_words.append({
                        "word": w["word"],
                        "abs_start": cue["start"] + w["offset"],
                    })

            # Walk through beats, consuming words by word count
            word_cursor = 0
            bt_list = []
            for bs in beat_scripts:
                wc = bs["wordCount"]
                if wc == 0:
                    # Beat with no narration — give it a tiny slice
                    start_t = all_words[word_cursor]["abs_start"] if word_cursor < len(all_words) else 0
                    bt_list.append({"beatId": bs["beatId"], "startTime": round(start_t, 3), "endTime": round(start_t + 0.1, 3)})
                    continue
                end_cursor = min(word_cursor + wc, len(all_words))
                start_t = all_words[word_cursor]["abs_start"] if word_cursor < len(all_words) else 0
                end_t = all_words[end_cursor - 1]["abs_start"] + 0.5 if end_cursor > 0 else start_t + 1
                # Extend to next beat's start or act end
                bt_list.append({"beatId": bs["beatId"], "startTime": round(start_t, 3), "endTime": round(end_t, 3)})
                word_cursor = end_cursor

            # Adjust endTimes so each beat ends when the next begins
            for j in range(len(bt_list) - 1):
                bt_list[j]["endTime"] = bt_list[j + 1]["startTime"]
            if bt_list:
                bt_list[-1]["endTime"] = round(act_dur, 3)

            beat_timings[aid] = bt_list
            print(f"    → {len(bt_list)} beat timings")

        # Rate limiting — be polite to the API
        if not cached:
            time.sleep(0.5)

    # ── Write output ──
    output_dir = os.path.dirname(content_path)
    output_path = os.path.join(output_dir, f"audio_{lesson_id}.js")
    write_audio_js(lesson_id, audio_map, subtitle_map, output_path,
                   beat_timings if beat_timings else None)

    size_kb = os.path.getsize(output_path) / 1024
    unit = "acts" if fmt == "v3" else "slides"
    print(f"\nDone! Output: {output_path} ({size_kb:.0f} KB)")
    print(f"  {len(audio_map)} {unit} with audio, {total_duration:.1f}s total duration")
    print(f"\nNext: bash build.sh {args.content_js} content/viz_nested_circles.js "
          f"dist/{lesson_id}.html {output_path}")


if __name__ == "__main__":
    main()
