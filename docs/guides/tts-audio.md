# TTS Audio

You can add narration audio and word-level subtitles to any lesson using the `generate_audio.py` script. It calls ElevenLabs, caches responses locally, and produces a single JavaScript file you pass to `build.sh`.

## Prerequisites

```bash
pip install requests
export ELEVENLABS_API_KEY="..."
```

## Generate audio

```bash
python generate_audio.py \
  --content content/my-lesson.js \
  --output content/audio_my-lesson.js \
  --voice-id <voice-id> \
  --model-id eleven_multilingual_v2
```

This:
1. Evaluates `content/my-lesson.js` in Node.js to extract narration scripts per act
2. Calls ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps` for each act
3. Caches responses in `audio_cache/` by content hash — re-running is free if scripts haven't changed
4. Produces `content/audio_my-lesson.js` with inline base64 audio + word-level subtitle cues

## Build with audio

```bash
./build.sh --mx content/my-lesson.js dist/my-lesson.html content/audio_my-lesson.js
```

## What the audio file contains

```js
// Appended to window.LESSON by build.sh
L.audio = {
  "act-1": "data:audio/mpeg;base64,...",
  "act-2": "data:audio/mpeg;base64,..."
};

L.subtitles = {
  "act-1": [
    { start: 0, end: 3.2, text: "Every quadratic equation...", words: [
      { word: "Every",     offset: 0.0 },
      { word: "quadratic", offset: 0.41 },
      { word: "equation",  offset: 0.87 }
    ]},
    { start: 3.2, end: 6.5, text: "has the form ax-squared..." }
  ]
};

L.beatTimings = {
  "act-1": [
    { beatId: "b1", startTime: 0,   endTime: 4.2 },
    { beatId: "b2", startTime: 4.2, endTime: 9.1 }
  ]
};
```

## Subtitles without audio

If you don't provide audio, the engine auto-generates subtitle cues from the narration text at ~2.5 words per second. These won't have word-level highlighting.

## Subtitle display

The subtitle bar appears at the bottom of the viz panel. Students can toggle it with the CC button in the controls. Toggle audio with the speaker button.

## Caching

Responses are cached in `audio_cache/<sha256_of_text>.json`. Delete the cache directory to force regeneration.

```bash
rm -rf audio_cache/
```

## Voice IDs

Find voice IDs in your ElevenLabs dashboard or via the API. Common ones:

| Voice | ID |
|-------|----|
| Rachel (default) | `21m00Tcm4TlvDq8ikWAM` |
| Adam | `pNInz6obpgDQGcFmaJgB` |
| Bella | `EXAVITQu4vr4xnSDxMaL` |

Pass `--voice-id` to select a voice.
