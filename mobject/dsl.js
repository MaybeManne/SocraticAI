/* ═══════════════════════════════════════════════════════════════════
   Explainer Teacher DSL v2.1 — Act/Beat/Milestone Lesson Authoring

   v2 additions:
   - vizConfig supports viewBox: "0 0 800 400" for custom SVG sizes
   - Educators have full freedom over SVG dimensions

   Usage:
     MX.lesson("Nested Circles", function(L) {
       L.source("AMC 10A 2023 #15");
       L.vizConfig({ viewBox: "0 0 800 400" }); // custom SVG size
       L.problem("Find $x$ given $x^2 + 3 = 7$.");

       L.act("Introduction", function(A) {
         A.say("Welcome to this lesson.")
          .title("AMC 2023", "Nested Circles");
         A.say("Let's start by visualizing.")
          .do("showGrid");
       });

       L.marker("derivation");

       L.act("Ring Area", function(A) {
         A.say("The k-th green ring has area...")
          .show("$A_k = \\pi(4k - 1)$")
          .do("highlightRing", { k: 2 });
       });

       L.ask({
         question: "Area of a circle with radius $r$?",
         options: ["$2\\pi r$", "$\\pi r^2$"],
         correct: 1,
         explain: { correct: "Exactly!", 0: "That's circumference." },
         wrongPath: function(B) {
           B.act("Recap", function(A) {
             A.say("Area is pi r squared.").show("$A = \\pi r^2$");
           });
         }
       });
     });
   ═══════════════════════════════════════════════════════════════════ */
(function() {
"use strict";

var MX = window.MX;
if (!MX) throw new Error("explainer-mobject.js must be loaded before explainer-dsl.js");

/* ── Internal ID generators ── */
var _actN = 0, _beatN = 0, _msN = 0;
function actId(prefix) { return (prefix || "act") + "-" + (++_actN); }
function beatId() { return "b" + (++_beatN); }
function msId() { return "ms" + (++_msN); }


/* ═══════════════════════════════════════════════════════════════════
   BeatRef — returned by A.say(), supports chaining
   ═══════════════════════════════════════════════════════════════════ */
class BeatRef {
  constructor(actBuilder, idx) {
    this._act = actBuilder;
    this._idx = idx;
  }

  _beat() { return this._act._beats[this._idx]; }

  /* Attach a notebook card. Content can be:
     - string: rendered as rich text (KaTeX + bold)
     - {type: "derivation", title, steps: [...]}
     - {type: "bar-chart", title, bars: [...], ...}
     - {type: "figure", svg, caption}
     - {type: "recap", title, content: [...]}
     - etc.
     A plain string becomes {type: "text", content: str} */
  show(content, opts) {
    var card;
    if (typeof content === "string") {
      card = { type: "text", content: content };
    } else if (Array.isArray(content)) {
      // Array of strings/objects → recap-style content list
      card = { type: "recap", content: content.map(function(item) {
        return typeof item === "string" ? { type: "text", value: item } : item;
      })};
    } else {
      card = content;
    }
    if (opts) {
      for (var k in opts) card[k] = opts[k];
    }
    this._beat().card = card;
    return this;
  }

  /* Shorthand: title card */
  title(heading, subheading) {
    this._beat().card = { type: "title", heading: heading, subheading: subheading || "" };
    return this;
  }

  /* Explicit typed card */
  card(type, data) {
    data = data || {};
    data.type = type;
    this._beat().card = data;
    return this;
  }

  /* Append a viz action.
     offset: GSAP-style position string like "+1.0" for sub-beat delay,
             or a number (seconds after beat start). Default: 0 */
  do(method, params, offset) {
    this._beat().vizActions.push({
      method: method,
      params: params || {},
      offset: offset || 0
    });
    return this;
  }

  /* Set the viz panel mode for this beat's duration */
  vizPanel(mode) {
    this._beat().vizPanel = mode;
    this._beat()._explicitVizPanel = mode;
    return this;
  }

  /* Override estimated duration for this beat (seconds) */
  duration(d) {
    this._beat().duration = d;
    return this;
  }

  /* When this beat ends, migrate the current viz panel content
     inline into the notebook (zoom-out animation).
     Options: "figure" | "chart" | "svg" | true (auto-detect) */
  inline(opts) {
    this._beat().inlineViz = opts || true;
    return this;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   ActBuilder — passed to L.act() callback
   ═══════════════════════════════════════════════════════════════════ */
class ActBuilder {
  constructor(id, title) {
    this._id = id;
    this._title = title;
    this._beats = [];
    this._vizPanel = null; // default viz panel mode for all beats in this act
  }

  /* Create a new beat with narration text. Returns BeatRef for chaining. */
  say(text) {
    var beat = {
      id: beatId(),
      say: text,
      card: null,
      vizActions: [],
      vizPanel: null,
      duration: null
    };
    this._beats.push(beat);
    return new BeatRef(this, this._beats.length - 1);
  }

  /* Shorthand: create a silent beat with only a title card (no narration).
     Accepts A.title(heading, subheading) or A.title(heading, {sub: "..."}) */
  title(heading, optsOrSub) {
    var sub = typeof optsOrSub === "string" ? optsOrSub
            : (optsOrSub && optsOrSub.sub) ? optsOrSub.sub : "";
    var beat = {
      id: beatId(),
      say: null,
      card: { type: "title", heading: heading, subheading: sub },
      vizActions: [],
      vizPanel: null,
      duration: null
    };
    this._beats.push(beat);
    return new BeatRef(this, this._beats.length - 1);
  }

  /* Set default viz panel mode for all beats in this act */
  vizPanel(mode) {
    this._vizPanel = mode;
    return this;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   LessonBuilder — main builder, passed to MX.lesson() callback
   ═══════════════════════════════════════════════════════════════════ */
class LessonBuilder {
  constructor(title) {
    this._title = title;
    this._source = "";
    this._meta = {};
    this._problem = null;
    this._vizConfig = null;
    this._acts = [];
    this._milestones = [];
    this._branchActs = {};
    this._mainPath = [];
  }

  /* ── Metadata ── */
  source(s) { this._source = s; return this; }
  meta(obj) { Object.assign(this._meta, obj); return this; }

  /* ── Problem statement (pinned bar) ── */
  problem(text, opts) {
    opts = opts || {};
    this._problem = { text: text, highlight: opts.highlight || "" };
    return this;
  }

  /* ── Viz plugin config ── */
  vizConfig(cfg) { this._vizConfig = cfg; return this; }
  viz(cfg) { this._vizConfig = cfg; return this; }

  /* ── Create an act ── */
  act(title, fn) {
    var id = actId();
    var builder = new ActBuilder(id, title);
    fn(builder);

    // Apply default vizPanel to beats that don't have one
    if (builder._vizPanel) {
      builder._beats.forEach(function(beat) {
        if (!beat.vizPanel) beat.vizPanel = builder._vizPanel;
      });
    }

    var actDescriptor = {
      id: id,
      title: title,
      beats: builder._beats,
      duration: null, // filled by audio pipeline or estimated at runtime
      vizPanel: builder._vizPanel
    };

    this._acts.push(actDescriptor);
    this._mainPath.push(id);
    return this;
  }

  /* ── Passive milestone (section marker) ── */
  marker(label) {
    if (this._acts.length === 0) return this;
    var lastActId = this._acts[this._acts.length - 1].id;
    this._milestones.push({
      id: msId(),
      type: "marker",
      afterAct: lastActId,
      label: label
    });
    return this;
  }

  /* ── Interactive gate milestone ── */
  ask(opts) {
    if (this._acts.length === 0) return this;
    var lastActId = this._acts[this._acts.length - 1].id;

    var milestone = {
      id: msId(),
      type: "gate",
      afterAct: lastActId,
      label: opts.label || null,
      gate: {
        type: opts.type || "quiz",
        question: opts.question,
        options: opts.options,
        correct: opts.correct,
        explanations: opts.explain || opts.explanations || {},
        // fill-in specific
        prompt: opts.prompt,
        blank: opts.blank,
        hint: opts.hint,
        successMessage: opts.successMessage,
        // proof-builder specific
        instruction: opts.instruction,
        availablePieces: opts.availablePieces,
        correctOrder: opts.correctOrder,
        slots: opts.slots,
        // interactive gate specific
        title: opts.title,
        slider: opts.slider,
        compute: opts.compute,
        displays: opts.displays,
        challenge: opts.challenge
      },
      wrongPath: null
    };

    // Process wrong path branch
    if (opts.wrongPath) {
      var sub = new LessonBuilder("");
      opts.wrongPath(sub);
      // Merge sub's acts into branchActs
      var branchIds = [];
      sub._acts.forEach(function(branchAct) {
        branchAct._isBranch = true;
        branchAct.rejoinsAfter = milestone.id;
        this._branchActs[branchAct.id] = branchAct;
        branchIds.push(branchAct.id);
      }.bind(this));
      milestone.wrongPath = branchIds;
    }

    this._milestones.push(milestone);
    return this;
  }

  /* ── Fill-in gate shorthand ── */
  askFillIn(opts) {
    opts.type = "fill-in";
    return this.ask(opts);
  }

  /* ── Proof-builder gate shorthand ── */
  askProof(opts) {
    opts.type = "proof-builder";
    return this.ask(opts);
  }


  /* ═══════════════════════════════════════════════════════════════
     Build — compile to window.LESSON runtime format
     ═══════════════════════════════════════════════════════════════ */
  build() {
    // Estimate act durations from word count (~2.5 words/sec = 150 WPM)
    function estimateDuration(acts) {
      var WPS = 2.5;
      (Array.isArray(acts) ? acts : Object.values(acts)).forEach(function(act) {
        if (act.duration) return;
        var totalWords = 0;
        act.beats.forEach(function(beat) {
          if (beat.say) {
            totalWords += beat.say.split(/\s+/).length;
          }
        });
        act.duration = Math.max(2, Math.ceil(totalWords / WPS));
      });
    }

    estimateDuration(this._acts);
    estimateDuration(this._branchActs);

    var lesson = {
      meta: Object.assign({
        id: this._title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        title: this._title,
        source: this._source
      }, this._meta),
      problem: this._problem,
      viz: this._vizConfig ? (this._vizConfig.plugin ? this._vizConfig : { plugin: "mx", config: this._vizConfig }) : null,
      acts: this._acts,
      milestones: this._milestones,
      branchActs: this._branchActs,
      mainPath: this._mainPath
    };

    window.LESSON = lesson;
    return lesson;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   MX.lesson() — Entry point
   ═══════════════════════════════════════════════════════════════════ */
MX.lesson = function(title, fn) {
  var builder = new LessonBuilder(title);
  fn(builder);
  return builder.build();
};

MX.LessonBuilder = LessonBuilder;
MX.ActBuilder = ActBuilder;
MX.BeatRef = BeatRef;


/* ═══════════════════════════════════════════════════════════════════
   Viz Presets — common visualizations as one-liners
   ═══════════════════════════════════════════════════════════════════ */
MX.presets = {};

/* Number line preset */
MX.presets.numberLine = function(opts) {
  return MX.vizPlugin(function(scene, config) {
    var nl = MX.numberLine(Object.assign({
      range: [0, 10], length: 400, x: 50, y: 250
    }, opts));
    scene.add(nl);
    nl.opacity = 0;
    var markers = {};

    return {
      show: function(tl, params, t) {
        MX.fadeIn(nl, { duration: 0.8 }).apply(tl, t);
      },
      addPoint: function(tl, params, t) {
        var v = params.value || params.v;
        var dot = nl.addPoint(v, { color: params.color || MX.C.INDIGO });
        dot.opacity = 0;
        markers[v] = dot;
        MX.growFromCenter(dot, { duration: 0.4 }).apply(tl, t);
      },
      highlightRange: function(tl, params, t) {
        var from = nl.valToX(params.from), to = nl.valToX(params.to);
        var line = MX.line({
          from: [from, 0], to: [to, 0],
          stroke: params.color || MX.C.EMERALD, strokeWidth: 4
        });
        nl.el.appendChild(line.el);
        line.opacity = 0;
        MX.fadeIn(line, { duration: 0.5 }).apply(tl, t);
      }
    };
  });
};

/* Coordinate plane preset */
MX.presets.coordPlane = function(opts) {
  return MX.vizPlugin(function(scene, config) {
    opts = Object.assign({
      xRange: [-5, 5], yRange: [-5, 5], width: 400, height: 400
    }, opts);
    var ax = MX.axes(opts);
    ax.moveTo(50, 50);
    scene.add(ax);
    ax.opacity = 0;
    var plots = {};

    return {
      show: function(tl, params, t) {
        MX.fadeIn(ax, { duration: 0.8 }).apply(tl, t);
      },
      plotFn: function(tl, params, t) {
        var fn = typeof params.fn === "string" ? new Function("x", "return " + params.fn) : params.fn;
        var graph = MX.plot(fn, ax, {
          color: params.color || MX.C.INDIGO,
          xRange: params.xRange || opts.xRange,
          strokeWidth: params.strokeWidth || 2.5
        });
        scene.add(graph);
        graph.moveTo(ax.x, ax.y);
        plots[params.id || ("fn" + Object.keys(plots).length)] = graph;
        MX.write(graph, { duration: params.duration || 1.5 }).apply(tl, t);
      },
      addDot: function(tl, params, t) {
        var p = ax.c2p(params.x, params.y);
        var dot = MX.dot({
          x: ax.x + p.x, y: ax.y + p.y,
          radius: params.radius || 5,
          fill: params.color || MX.C.AMBER
        });
        scene.add(dot);
        dot.opacity = 0;
        MX.growFromCenter(dot, { duration: 0.4 }).apply(tl, t);
      },
      addLabel: function(tl, params, t) {
        var p = ax.c2p(params.x, params.y);
        var label = MX.text(params.text, {
          x: ax.x + p.x + (params.offsetX || 0),
          y: ax.y + p.y + (params.offsetY || -15),
          fontSize: params.fontSize || 13,
          color: params.color || MX.C.WHITE
        });
        scene.add(label);
        label.opacity = 0;
        MX.fadeIn(label, { duration: 0.4 }).apply(tl, t);
      }
    };
  });
};

/* Unit circle preset */
MX.presets.unitCircle = function(opts) {
  return MX.vizPlugin(function(scene, config) {
    var cx = 250, cy = 250, radius = 180;
    var ax = MX.axes({
      xRange: [-1.5, 1.5], yRange: [-1.5, 1.5],
      width: 360, height: 360, x: cx - 180, y: cy - 180,
      grid: false
    });
    var circle = MX.circle({ radius: radius, x: cx, y: cy, stroke: MX.C.INDIGO });
    scene.add(ax, circle);
    ax.opacity = 0; circle.opacity = 0;

    return {
      show: function(tl, params, t) {
        MX.fadeIn(ax, { duration: 0.5 }).apply(tl, t);
        MX.drawBorder(circle, { duration: 1.2 }).apply(tl, t + 0.3);
      },
      markAngle: function(tl, params, t) {
        var angle = (params.angle || 0) * Math.PI / 180;
        var px = cx + radius * Math.cos(angle);
        var py = cy - radius * Math.sin(angle);
        var line = MX.line({ from: [cx, cy], to: [px, py], stroke: MX.C.AMBER, strokeWidth: 1.5 });
        var dot = MX.dot({ x: px, y: py, radius: 4, fill: MX.C.AMBER });
        scene.add(line, dot);
        line.opacity = 0; dot.opacity = 0;
        MX.fadeIn(line, { duration: 0.3 }).apply(tl, t);
        MX.growFromCenter(dot, { duration: 0.3 }).apply(tl, t + 0.2);
      }
    };
  });
};


})();
