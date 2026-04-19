# DSL Reference

The DSL is the authoring interface for lessons. Entry point is `MX.lesson()`.

---

## `MX.lesson(title, fn)`

Creates a lesson and sets `window.LESSON`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Lesson title shown in the browser tab |
| `fn` | `function(L: LessonBuilder)` | Build callback — call `L.*` methods inside |

**Example**

```js
MX.lesson("The Pythagorean Theorem", function(L) {
  L.problem("Prove $a^2 + b^2 = c^2$.");
  L.act("Setup", function(A) { ... });
});
```

---

## LessonBuilder `L`

### `L.source(text)`

Sets attribution text shown in the browser tab and problem bar.

```js
L.source("AMC 10A 2023, Problem 15");
```

### `L.meta(obj)`

Stores arbitrary metadata on the lesson. `id` is used by the audio pipeline.

```js
L.meta({ id: "pythagorean_v2", grade: "8", tags: ["geometry"] });
```

### `L.problem(text, opts?)`

Sets the problem statement pinned at the top of the page.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `text` | `string` | Problem text — supports `$inline$` and `$$display$$` LaTeX |
| `opts.highlight` | `string` | Text to visually emphasize within the bar |

```js
L.problem("Find the value of $x$ such that $x^2 - 5x + 6 = 0$.", {
  highlight: "$x^2 - 5x + 6 = 0$"
});
```

### `L.viz(cfg)` / `L.vizConfig(cfg)`

Configures the visualization panel.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `cfg.config` | `object` | Values passed to `EXPLAINER_VIZ.init()` as the second argument |
| `cfg.viewBox` | `string` | SVG viewBox (default `"0 0 500 500"`) |

```js
L.viz({
  viewBox: "0 0 800 400",
  config: { cx: 400, cy: 200, scale: 32 }
});
```

### `L.act(title, fn)`

Adds a teaching segment to the lesson.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Act title shown in milestone dots tooltip |
| `fn` | `function(A: ActBuilder)` | Build callback |

```js
L.act("Introducing the Hypotenuse", function(A) {
  A.say("The longest side of a right triangle is called the hypotenuse.")
   .show("It's always opposite the right angle.");
});
```

### `L.marker(label)`

Adds a passive chapter divider — visible as a dot on the scrubber but doesn't pause playback.

```js
L.marker("Key Insight");
```

### `L.ask(opts)`

Adds an interactive gate. Pauses playback and displays a question. On correct answer, continues; on wrong answer (after the allowed attempts), plays `wrongPath` if provided.

**Parameters — all gate types**

| Name | Type | Description |
|------|------|-------------|
| `opts.type` | `string` | `"quiz"` \| `"fill-in"` \| `"proof-builder"` \| `"interactive"` |
| `opts.wrongPath` | `function(B: LessonBuilder)` | Branch lesson for wrong answers |

**Parameters — `quiz`**

| Name | Type | Description |
|------|------|-------------|
| `question` | `string` | Question text (supports LaTeX) |
| `options` | `string[]` | Answer choices (up to 8) |
| `correct` | `number` | Zero-based index of correct option |
| `explain` | `object` | Keys are `"correct"` or option index as string; values are explanation strings |

**Parameters — `fill-in`**

| Name | Type | Description |
|------|------|-------------|
| `prompt` | `string` | Sentence with `[___]` marking the blank position |
| `blank.answer` | `string[]` | Accepted answers (normalized for comparison) |
| `blank.width` | `string` | CSS width of input, e.g. `"80px"` |
| `blank.placeholder` | `string` | Placeholder text |
| `hint` | `string` | Shown after first wrong attempt |
| `successMessage` | `string` | Shown on correct answer |

**Parameters — `proof-builder`**

| Name | Type | Description |
|------|------|-------------|
| `instruction` | `string` | Instruction text (supports LaTeX) |
| `slots` | `number` | Number of slots to fill |
| `availablePieces` | `{id, latex}[]` | Draggable pieces |
| `correctOrder` | `string[]` | Piece IDs in correct order |
| `hint` | `string` | Shown after first wrong check |

**Parameters — `interactive`**

| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Title above the slider |
| `slider.min` | `number` | Minimum slider value |
| `slider.max` | `number` | Maximum slider value |
| `slider.step` | `number` | Step size |
| `slider.default` | `number` | Initial value |
| `compute` | `string \| function` | JS function string or function that receives the slider value and returns a result object |
| `displays` | `{field, label, style?}[]` | Fields from the compute result to display |
| `challenge` | `string` | Optional challenge prompt (supports LaTeX) |

> **Note:** `interactive` gates always resolve as correct — they are explorations, not assessments. `wrongPath` is ignored.

### `L.askFillIn(opts)` / `L.askProof(opts)`

Shorthands for `L.ask({ type: "fill-in", ... })` and `L.ask({ type: "proof-builder", ... })`.

---

## ActBuilder `A`

Received by the callback in `L.act()`.

### `A.say(text)`

Creates a beat with narration. Returns a `BeatRef` for chaining.

```js
A.say("The hypotenuse is the longest side.");
```

### `A.title(heading, subheading?)`

Creates a silent beat that displays a full-screen title overlay. Returns a `BeatRef`.

```js
A.title("Chapter 2", "The Key Insight");
```

### `A.vizPanel(mode)`

Sets the default visualization panel mode for all beats in this act. Overridable per beat.

**`mode` values:** `"svg"` | `"figure"` | `"chart"` | `"hidden"` | `"wide"` | `"3d"`

```js
A.vizPanel("hidden");  // notebook takes full width for this act
```

---

## BeatRef

Returned by `A.say()` and `A.title()`. All methods return `this` for chaining.

### `.show(content)`

Attaches a card to this beat. Content is auto-detected:

| `content` | Card created |
|-----------|-------------|
| `"some text"` | `text` card |
| `"$$x^2$$"` | `latex` card |
| `{ type: "...", ... }` | Typed card |

```js
A.say("The formula is:").show("$$E = mc^2$$");
```

### `.card(type, data)`

Attaches a typed card explicitly. See [Card Types](./card-types.md) for all types and their data schemas.

```js
A.say("Here's the derivation.")
 .card("derivation", { title: "Proof", steps: [...] });
```

### `.do(method, params?, offset?)`

Schedules a visualization action.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `method` | `string` | Method name in `EXPLAINER_VIZ.timelineAction` |
| `params` | `object` | Passed to the plugin method (default `{}`) |
| `offset` | `string \| number` | When to fire relative to beat start (default `0`) |

**Offset values:**
- `0` — at beat start
- `"+0.5"` — 0.5 s after beat start
- `1.2` — 1.2 s absolute from beat start

```js
A.say("Watch the circle appear, then the label.")
 .do("showCircle")
 .do("showLabel", { text: "O" }, "+0.6");
```

### `.vizPanel(mode)`

Overrides the act-level vizPanel mode for this beat only.

### `.inline(type?)`

Snapshots the current viz panel state and inserts it as a frozen image in the notebook card.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `type` | `string` | `"svg"` \| `"figure"` \| `"chart"` \| `true` (auto-detect) |

```js
A.say("Here's the final diagram.").inline();
A.say("Here's the chart.").inline("chart");
```

### `.duration(seconds)`

Overrides the auto-estimated duration for this beat.

```js
A.say("Take a moment.").duration(4);
```

### `.title(heading, subheading?)`

Shorthand to attach a `title` card to this beat.

```js
A.say("").title("Part II", "The Proof");
```
