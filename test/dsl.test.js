/**
 * DSL Unit Tests — LessonBuilder, ActBuilder, BeatRef
 *
 * Tests that MX.lesson() and its builder API produce the correct
 * window.LESSON JSON structure consumed by the engine.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock } from './browser-mock.js';
import { loadMX } from './load-engine.js';

let MX;

beforeEach(() => {
  resetBrowserMock();
  MX = loadMX();
});

// ─────────────────────────────────────────────────────
//  LessonBuilder — top-level structure
// ─────────────────────────────────────────────────────
describe('LessonBuilder', () => {
  it('produces a lesson with meta, title, and source', () => {
    const lesson = MX.lesson('Test Lesson', L => {
      L.source('Unit Test');
      L.meta({ answer: '42' });
      L.act('Act 1', A => { A.say('Hello'); });
    });

    expect(lesson.meta.title).toBe('Test Lesson');
    expect(lesson.meta.source).toBe('Unit Test');
    expect(lesson.meta.answer).toBe('42');
    expect(lesson.meta.id).toBe('test_lesson');
  });

  it('generates a slug id from the title', () => {
    const lesson = MX.lesson('AMC 10A 2023 #15', L => {
      L.act('A', A => { A.say('x'); });
    });
    expect(lesson.meta.id).toBe('amc_10a_2023_15');
  });

  it('stores the problem statement and highlight', () => {
    const lesson = MX.lesson('P', L => {
      L.problem('Find $x$.', { highlight: 'Solve for x' });
      L.act('A', A => { A.say('x'); });
    });

    expect(lesson.problem.text).toBe('Find $x$.');
    expect(lesson.problem.highlight).toBe('Solve for x');
  });

  it('stores viz config via L.viz()', () => {
    const lesson = MX.lesson('V', L => {
      L.viz({ plugin: 'circles', config: { r: 5 } });
      L.act('A', A => { A.say('x'); });
    });

    expect(lesson.viz.plugin).toBe('circles');
    expect(lesson.viz.config.r).toBe(5);
  });

  it('stores viz config via L.vizConfig()', () => {
    const lesson = MX.lesson('V', L => {
      L.vizConfig({ viewBox: '0 0 800 400' });
      L.act('A', A => { A.say('x'); });
    });

    // vizConfig without plugin gets wrapped
    expect(lesson.viz.plugin).toBe('mx');
    expect(lesson.viz.config.viewBox).toBe('0 0 800 400');
  });

  it('creates acts with unique IDs on the mainPath', () => {
    const lesson = MX.lesson('M', L => {
      L.act('Act One', A => { A.say('a'); });
      L.act('Act Two', A => { A.say('b'); });
    });

    expect(lesson.acts).toHaveLength(2);
    expect(lesson.acts[0].title).toBe('Act One');
    expect(lesson.acts[1].title).toBe('Act Two');
    expect(lesson.acts[0].id).not.toBe(lesson.acts[1].id);
    expect(lesson.mainPath).toHaveLength(2);
    expect(lesson.mainPath[0]).toBe(lesson.acts[0].id);
    expect(lesson.mainPath[1]).toBe(lesson.acts[1].id);
  });

  it('estimates act durations from word count when not provided', () => {
    const lesson = MX.lesson('D', L => {
      // 10 words at 2.5 WPS = 4 seconds
      L.act('A', A => { A.say('one two three four five six seven eight nine ten'); });
    });

    expect(lesson.acts[0].duration).toBe(4);
  });

  it('enforces a minimum act duration of 2 seconds', () => {
    const lesson = MX.lesson('D', L => {
      L.act('A', A => { A.say('hi'); }); // 1 word → ~0.4s, clamped to 2
    });

    expect(lesson.acts[0].duration).toBe(2);
  });

  it('sets window.LESSON on build', () => {
    MX.lesson('W', L => {
      L.act('A', A => { A.say('x'); });
    });

    expect(window.LESSON).toBeDefined();
    expect(window.LESSON.meta.title).toBe('W');
  });
});

// ─────────────────────────────────────────────────────
//  ActBuilder — beats within an act
// ─────────────────────────────────────────────────────
describe('ActBuilder', () => {
  it('creates beats from A.say() calls', () => {
    const lesson = MX.lesson('B', L => {
      L.act('Act', A => {
        A.say('First beat');
        A.say('Second beat');
      });
    });

    const beats = lesson.acts[0].beats;
    expect(beats).toHaveLength(2);
    expect(beats[0].say).toBe('First beat');
    expect(beats[1].say).toBe('Second beat');
  });

  it('assigns unique IDs to each beat', () => {
    const lesson = MX.lesson('B', L => {
      L.act('A', A => {
        A.say('a');
        A.say('b');
      });
    });

    const beats = lesson.acts[0].beats;
    expect(beats[0].id).toBeTruthy();
    expect(beats[1].id).toBeTruthy();
    expect(beats[0].id).not.toBe(beats[1].id);
  });

  it('creates title beats with A.title()', () => {
    const lesson = MX.lesson('T', L => {
      L.act('A', A => {
        A.title('Main Heading', 'Subheading');
      });
    });

    const beat = lesson.acts[0].beats[0];
    expect(beat.say).toBeNull();
    expect(beat.card.type).toBe('title');
    expect(beat.card.heading).toBe('Main Heading');
    expect(beat.card.subheading).toBe('Subheading');
  });

  it('applies default vizPanel to all beats', () => {
    const lesson = MX.lesson('VP', L => {
      L.act('A', A => {
        A.vizPanel('svg');
        A.say('a');
        A.say('b');
      });
    });

    expect(lesson.acts[0].beats[0].vizPanel).toBe('svg');
    expect(lesson.acts[0].beats[1].vizPanel).toBe('svg');
  });

  it('does not override explicit beat vizPanel with act default', () => {
    const lesson = MX.lesson('VP', L => {
      L.act('A', A => {
        A.vizPanel('svg');
        A.say('a').vizPanel('hidden');
        A.say('b');
      });
    });

    expect(lesson.acts[0].beats[0].vizPanel).toBe('hidden');
    expect(lesson.acts[0].beats[1].vizPanel).toBe('svg');
  });
});

// ─────────────────────────────────────────────────────
//  BeatRef — chainable methods on A.say()
// ─────────────────────────────────────────────────────
describe('BeatRef', () => {
  it('.show(string) creates a text card', () => {
    const lesson = MX.lesson('S', L => {
      L.act('A', A => {
        A.say('Narration').show('Some text');
      });
    });

    const card = lesson.acts[0].beats[0].card;
    expect(card.type).toBe('text');
    expect(card.content).toBe('Some text');
  });

  it('.show(object) passes through as-is', () => {
    const lesson = MX.lesson('S', L => {
      L.act('A', A => {
        A.say('N').show({ type: 'latex', content: 'x^2' });
      });
    });

    const card = lesson.acts[0].beats[0].card;
    expect(card.type).toBe('latex');
    expect(card.content).toBe('x^2');
  });

  it('.show(array) creates a recap card', () => {
    const lesson = MX.lesson('S', L => {
      L.act('A', A => {
        A.say('N').show(['step 1', 'step 2']);
      });
    });

    const card = lesson.acts[0].beats[0].card;
    expect(card.type).toBe('recap');
    expect(card.content).toHaveLength(2);
    expect(card.content[0].type).toBe('text');
    expect(card.content[0].value).toBe('step 1');
  });

  it('.title() creates a title card', () => {
    const lesson = MX.lesson('T', L => {
      L.act('A', A => {
        A.say('N').title('Heading', 'Sub');
      });
    });

    const card = lesson.acts[0].beats[0].card;
    expect(card.type).toBe('title');
    expect(card.heading).toBe('Heading');
    expect(card.subheading).toBe('Sub');
  });

  it('.card(type, data) creates an explicit typed card', () => {
    const lesson = MX.lesson('C', L => {
      L.act('A', A => {
        A.say('N').card('derivation', { title: 'Proof', steps: [{ expr: 'x=1' }] });
      });
    });

    const card = lesson.acts[0].beats[0].card;
    expect(card.type).toBe('derivation');
    expect(card.title).toBe('Proof');
    expect(card.steps[0].expr).toBe('x=1');
  });

  it('.do() appends viz actions', () => {
    const lesson = MX.lesson('D', L => {
      L.act('A', A => {
        A.say('N')
          .do('showGrid')
          .do('drawCircle', { r: 3 })
          .do('glow', {}, '+0.5');
      });
    });

    const actions = lesson.acts[0].beats[0].vizActions;
    expect(actions).toHaveLength(3);
    expect(actions[0].method).toBe('showGrid');
    expect(actions[0].params).toEqual({});
    expect(actions[1].method).toBe('drawCircle');
    expect(actions[1].params).toEqual({ r: 3 });
    expect(actions[2].offset).toBe('+0.5');
  });

  it('.duration() overrides estimated beat duration', () => {
    const lesson = MX.lesson('Dur', L => {
      L.act('A', A => {
        A.say('N').duration(7.5);
      });
    });

    expect(lesson.acts[0].beats[0].duration).toBe(7.5);
  });

  it('.inline() sets inlineViz flag', () => {
    const lesson = MX.lesson('I', L => {
      L.act('A', A => {
        A.say('N').inline('figure');
      });
    });

    expect(lesson.acts[0].beats[0].inlineViz).toBe('figure');
  });

  it('.inline() with no argument defaults to true', () => {
    const lesson = MX.lesson('I', L => {
      L.act('A', A => {
        A.say('N').inline();
      });
    });

    expect(lesson.acts[0].beats[0].inlineViz).toBe(true);
  });

  it('chains are fluent — all methods return this', () => {
    const lesson = MX.lesson('Chain', L => {
      L.act('A', A => {
        const ref = A.say('N')
          .show('text')
          .do('a')
          .do('b')
          .vizPanel('svg')
          .duration(5)
          .inline();
        // If any method didn't return `this`, the chain would break
        expect(ref).toBeDefined();
      });
    });

    const beat = lesson.acts[0].beats[0];
    expect(beat.card.content).toBe('text');
    expect(beat.vizActions).toHaveLength(2);
    expect(beat.vizPanel).toBe('svg');
    expect(beat.duration).toBe(5);
    expect(beat.inlineViz).toBe(true);
  });
});

// ─────────────────────────────────────────────────────
//  Milestones — markers and gates
// ─────────────────────────────────────────────────────
describe('Milestones', () => {
  it('L.marker() creates a passive milestone after the last act', () => {
    const lesson = MX.lesson('Mk', L => {
      L.act('A1', A => { A.say('x'); });
      L.marker('section-break');
      L.act('A2', A => { A.say('y'); });
    });

    expect(lesson.milestones).toHaveLength(1);
    expect(lesson.milestones[0].type).toBe('marker');
    expect(lesson.milestones[0].label).toBe('section-break');
    expect(lesson.milestones[0].afterAct).toBe(lesson.acts[0].id);
  });

  it('L.marker() before any act is a no-op', () => {
    const lesson = MX.lesson('Mk', L => {
      L.marker('too-early');
      L.act('A1', A => { A.say('x'); });
    });

    expect(lesson.milestones).toHaveLength(0);
  });

  it('L.ask() creates a quiz gate with options and explanations', () => {
    const lesson = MX.lesson('Q', L => {
      L.act('A', A => { A.say('x'); });
      L.ask({
        question: 'What is 2+2?',
        options: ['3', '4', '5'],
        correct: 1,
        explain: { correct: 'Yes!', '0': 'Nope', '2': 'Nope' },
      });
    });

    const ms = lesson.milestones[0];
    expect(ms.type).toBe('gate');
    expect(ms.gate.type).toBe('quiz');
    expect(ms.gate.question).toBe('What is 2+2?');
    expect(ms.gate.options).toEqual(['3', '4', '5']);
    expect(ms.gate.correct).toBe(1);
    expect(ms.gate.explanations.correct).toBe('Yes!');
  });

  it('L.askFillIn() creates a fill-in gate', () => {
    const lesson = MX.lesson('F', L => {
      L.act('A', A => { A.say('x'); });
      L.askFillIn({
        prompt: 'What is $\\pi(2)^2$? [___]',
        blank: { answer: ['4pi'], width: 70 },
        hint: 'Square it',
        successMessage: 'Correct!',
      });
    });

    const ms = lesson.milestones[0];
    expect(ms.gate.type).toBe('fill-in');
    expect(ms.gate.prompt).toContain('[___]');
    expect(ms.gate.blank.answer).toEqual(['4pi']);
  });

  it('L.askProof() creates a proof-builder gate', () => {
    const lesson = MX.lesson('PB', L => {
      L.act('A', A => { A.say('x'); });
      L.askProof({
        instruction: 'Order the steps',
        availablePieces: [{ id: 'a', latex: 'x' }],
        correctOrder: ['a'],
        slots: 1,
      });
    });

    const ms = lesson.milestones[0];
    expect(ms.gate.type).toBe('proof-builder');
    expect(ms.gate.instruction).toBe('Order the steps');
    expect(ms.gate.slots).toBe(1);
  });
});

// ─────────────────────────────────────────────────────
//  Wrong-path branches
// ─────────────────────────────────────────────────────
describe('Wrong-path branches', () => {
  it('wrongPath callback creates branch acts linked to the gate', () => {
    const lesson = MX.lesson('WP', L => {
      L.act('Main', A => { A.say('x'); });
      L.ask({
        question: 'Q?',
        options: ['A', 'B'],
        correct: 0,
        wrongPath: B => {
          B.act('Recap', A => {
            A.say('Let me explain again.');
          });
        },
      });
    });

    const ms = lesson.milestones[0];
    expect(ms.wrongPath).toHaveLength(1);

    const branchId = ms.wrongPath[0];
    expect(lesson.branchActs[branchId]).toBeDefined();
    expect(lesson.branchActs[branchId].title).toBe('Recap');
    expect(lesson.branchActs[branchId]._isBranch).toBe(true);
    expect(lesson.branchActs[branchId].rejoinsAfter).toBe(ms.id);
  });

  it('branch acts have estimated durations', () => {
    const lesson = MX.lesson('WP', L => {
      L.act('Main', A => { A.say('x'); });
      L.ask({
        question: 'Q?',
        options: ['A', 'B'],
        correct: 0,
        wrongPath: B => {
          B.act('Recap', A => {
            A.say('one two three four five six seven eight nine ten');
          });
        },
      });
    });

    const branchId = lesson.milestones[0].wrongPath[0];
    expect(lesson.branchActs[branchId].duration).toBe(4);
  });

  it('multiple branch acts are all created', () => {
    const lesson = MX.lesson('WP', L => {
      L.act('Main', A => { A.say('x'); });
      L.ask({
        question: 'Q?',
        options: ['A', 'B'],
        correct: 0,
        wrongPath: B => {
          B.act('Recap 1', A => { A.say('step 1'); });
          B.act('Recap 2', A => { A.say('step 2'); });
        },
      });
    });

    expect(lesson.milestones[0].wrongPath).toHaveLength(2);
    const [id1, id2] = lesson.milestones[0].wrongPath;
    expect(lesson.branchActs[id1].title).toBe('Recap 1');
    expect(lesson.branchActs[id2].title).toBe('Recap 2');
  });
});
