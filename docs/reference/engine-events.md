# Engine Events Reference

The engine uses a pub/sub `EventBus` for communication between modules. You can listen to any of these events in a viz plugin or custom extension.

```js
var EventBus = window.EX.EventBus;

// Subscribe
EventBus.on("beat:enter", function(data) {
  console.log("Beat started:", data.beatId);
});

// Unsubscribe
EventBus.off("beat:enter", handler);

// Emit (rarely needed from plugins)
EventBus.emit("event:name", { key: "value" });
```

---

## Playback events

| Event | Data | Description |
|-------|------|-------------|
| `playback:tick` | `{ time }` | Fires every rAF frame during playback. `time` is the act-local time. |
| `act:start` | `{ act }` | An act has started. `act` is the `ActDescriptor`. |
| `act:end` | `{ actId }` | An act has finished playing. |
| `beat:enter` | `{ beatId }` | A beat has become active. |
| `beat:render` | `{ beat }` | A beat should render its card. `CardSystem` listens to this. |
| `lesson:end` | `{}` | The final act has completed. |

---

## State machine events

| Event | Data | Description |
|-------|------|-------------|
| `state:change` | `{ from, to }` | Phase transition. `from` and `to` are phase strings. |

Phase values: `"idle"` → `"playing"` ↔ `"paused"` → `"gate"` → `"ended"`

---

## Gate events

| Event | Data | Description |
|-------|------|-------------|
| `gate:enter` | `{ milestone }` | A gate has been reached. `milestone` contains the gate definition. |
| `gate:resolve` | `{ correct, milestone }` | Student answered the gate. `correct` is `true` or `false`. |
| `gate:renderPassed` | `{ milestone }` | A gate was previously passed (on replay/seek) — render it as passed. |

---

## Viz events

| Event | Data | Description |
|-------|------|-------------|
| `viz:runActions` | `{ actions, timeline, time, instant }` | Run visualization actions. `instant: true` means seek mode — skip to final state. |
| `viz:reset` | `{}` | Clear the SVG and re-run `init`. Fires on act change and seek. |

---

## Audio events

| Event | Data | Description |
|-------|------|-------------|
| `audio:loadAndPlay` | `{ actId, startTime }` | Load and play audio for an act. |
| `audio:stop` | `{}` | Stop playback. |
| `audio:pause` | `{}` | Pause. |
| `audio:resume` | `{}` | Resume. |
| `audio:seekTo` | `{ time }` | Seek audio to time. |
| `audio:setRate` | `{ rate }` | Set playback rate (0.5–2.0). |
| `audio:setEnabled` | `{ enabled }` | Enable or disable audio. |
| `audio:getTime` | `{ callback }` | Request current audio time via callback. |

---

## Notebook events

| Event | Data | Description |
|-------|------|-------------|
| `notebook:appendBeat` | `{ beatId, element }` | Append a card to the notebook. |
| `notebook:appendMilestone` | `{ milestoneId, element }` | Append a gate card to the notebook. |

---

## Scroll events

| Event | Data | Description |
|-------|------|-------------|
| `scroll:observe` | `{ element }` | Register an element with the IntersectionObserver for scroll sync. |
| `scroll:toBeat` | `{ beatId }` | Scroll the notebook to a specific beat. |

---

## Subtitle events

| Event | Data | Description |
|-------|------|-------------|
| `subtitles:load` | `{ actId, beats }` | Load subtitle cues for an act. |

---

## Recovery events

| Event | Data | Description |
|-------|------|-------------|
| `recover:reset` | `{}` | Hard reset — all modules clear their state. Fired when the engine detects a stuck state. |

---

## Example: Sync a custom overlay to beats

```js
EventBus.on("beat:enter", function(data) {
  var overlay = document.getElementById("my-overlay");
  overlay.textContent = "Beat: " + data.beatId;
});

EventBus.on("state:change", function(data) {
  if (data.to === "gate") {
    // hide overlay during gates
    document.getElementById("my-overlay").style.opacity = "0";
  } else if (data.from === "gate") {
    document.getElementById("my-overlay").style.opacity = "1";
  }
});
```
