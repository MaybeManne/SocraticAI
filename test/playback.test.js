/**
 * Playback Integration Tests — LessonGraph, PlaybackState, ActRunner, Orchestrator
 *
 * Tests act sequencing, gate pausing, branch injection, seeking, and
 * the stuck-state recovery mechanism.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let MX, EX;

function buildLesson(fn) {
  return MX.lesson('Test', fn);
}

function makeTwoActLessonWithGate() {
  return buildLesson(L => {
    L.act('Act One', A => { A.say('Hello world'); });
    L.ask({
      question: 'Q?',
      options: ['A', 'B'],
      correct: 0,
      explain: { correct: 'Yes' },
      wrongPath: B => {
        B.act('Recap', A => { A.say('Review material'); });
      },
    });
    L.act('Act Two', A => { A.say('Continuing on'); });
  });
}

beforeEach(() => {
  resetBrowserMock();
  ({ MX, EX } = loadAll());
});

// ─────────────────────────────────────────────────────
//  LessonGraph
// ─────────────────────────────────────────────────────
describe('LessonGraph', () => {
  it('indexes all acts by ID (main + branch)', () => {
    const lesson = makeTwoActLessonWithGate();
    const graph = new EX.LessonGraph(lesson);

    expect(Object.keys(graph.allActs).length).toBe(3); // 2 main + 1 branch
    for (const id of lesson.mainPath) {
      expect(graph.allActs[id]).toBeDefined();
    }
  });

  it('computes total default duration from main path acts', () => {
    const lesson = buildLesson(L => {
      L.act('A1', A => { A.say('one two three four five'); }); // 5 words / 2.5 = 2s
      L.act('A2', A => { A.say('one two three four five six seven eight nine ten'); }); // 10 words / 2.5 = 4s
    });
    const graph = new EX.LessonGraph(lesson);

    expect(graph.totalDefaultDuration).toBe(6); // 2 + 4
  });

  it('resolveDefaultTime maps global time to act + localTime', () => {
    const lesson = buildLesson(L => {
      L.act('A1', A => { A.say('one two three four five'); }); // 2s
      L.act('A2', A => { A.say('one two three four five six seven eight nine ten'); }); // 4s
    });
    const graph = new EX.LessonGraph(lesson);

    // t=1 → act 0, localTime 1
    const r1 = graph.resolveDefaultTime(1);
    expect(r1.pathIndex).toBe(0);
    expect(r1.localTime).toBe(1);

    // t=3 → act 1, localTime 1 (first act is 2s)
    const r2 = graph.resolveDefaultTime(3);
    expect(r2.pathIndex).toBe(1);
    expect(r2.localTime).toBe(1);
  });

  it('getMilestonePositions returns fractional positions', () => {
    const lesson = makeTwoActLessonWithGate();
    const graph = new EX.LessonGraph(lesson);
    const positions = graph.getMilestonePositions();

    expect(positions.length).toBeGreaterThan(0);
    expect(positions[0].type).toBe('gate');
    expect(positions[0].position).toBeGreaterThan(0);
    expect(positions[0].position).toBeLessThanOrEqual(1);
  });

  it('milestoneAfter indexes milestones by the act they follow', () => {
    const lesson = makeTwoActLessonWithGate();
    const graph = new EX.LessonGraph(lesson);

    const firstActId = lesson.mainPath[0];
    const ms = graph.milestoneAfter[firstActId];
    expect(ms).toBeDefined();
    expect(ms.type).toBe('gate');
  });
});

// ─────────────────────────────────────────────────────
//  PlaybackState
// ─────────────────────────────────────────────────────
describe('PlaybackState', () => {
  it('starts in idle phase', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);

    expect(state.phase).toBe('idle');
    expect(state.cursorIndex).toBe(-1);
  });

  it('start() advances to the first act', () => {
    const lesson = buildLesson(L => {
      L.act('A1', A => { A.say('x'); });
      L.act('A2', A => { A.say('y'); });
    });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    state.start();

    expect(state.defaultIndex).toBe(0);
    expect(state.getCurrentActId()).toBe(lesson.mainPath[0]);
  });

  it('advanceToNextAct() walks through the default path', () => {
    const lesson = buildLesson(L => {
      L.act('A1', A => { A.say('x'); });
      L.act('A2', A => { A.say('y'); });
    });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    state.start(); // → act 0

    const id = state.advanceToNextAct(); // → act 1
    expect(id).toBe(lesson.mainPath[1]);
    expect(state.defaultIndex).toBe(1);
  });

  it('advanceToNextAct() transitions to ended after last act', () => {
    const lesson = buildLesson(L => {
      L.act('Only', A => { A.say('x'); });
    });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    state.phase = 'playing';
    state.start(); // → act 0

    const id = state.advanceToNextAct(); // → past end
    expect(id).toBeNull();
    expect(state.phase).toBe('ended');
  });

  it('transition() validates state transitions', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);

    expect(state.transition('playing')).toBe(true);
    expect(state.phase).toBe('playing');
    expect(state.transition('paused')).toBe(true);
    expect(state.phase).toBe('paused');

    // Invalid: paused → gate
    expect(state.transition('gate')).toBe(false);
    expect(state.phase).toBe('paused'); // unchanged
  });

  it('enterBranch() sets up branch path and returns first branch act', () => {
    const lesson = makeTwoActLessonWithGate();
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    state.phase = 'playing';
    state.start();

    const branchIds = lesson.milestones[0].wrongPath;
    const firstId = state.enterBranch(branchIds, 1);

    expect(firstId).toBe(branchIds[0]);
    expect(state._onBranchPath).toBe(true);
    expect(state.getCurrentActId()).toBe(branchIds[0]);
  });

  it('getScrubberTime() returns gate position during branch', () => {
    const lesson = makeTwoActLessonWithGate();
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    state.phase = 'playing';
    state.start();

    const branchIds = lesson.milestones[0].wrongPath;
    state.enterBranch(branchIds, 1);

    // Should show the position at the gate, not the branch act
    const t = state.getScrubberTime();
    expect(t).toBe(graph.getDefaultCumulativeTime(1, 0));
  });
});

// ─────────────────────────────────────────────────────
//  ActRunner
// ─────────────────────────────────────────────────────
describe('ActRunner', () => {
  it('loadAct() builds beat cues and a GSAP timeline', () => {
    const lesson = buildLesson(L => {
      L.act('A', A => {
        A.say('First beat here');
        A.say('Second beat here');
      });
    });
    const graph = new EX.LessonGraph(lesson);
    // need graph on window for _buildBeatCues
    window._graph = graph;

    EX.ActRunner.loadAct(lesson.acts[0]);

    expect(EX.ActRunner.masterTl).not.toBeNull();
    expect(EX.ActRunner.beatCues).toHaveLength(2);
    expect(EX.ActRunner.beatCues[0].startTime).toBe(0);
    expect(EX.ActRunner.beatCues[1].startTime).toBeGreaterThan(0);
    expect(EX.ActRunner._currentActId).toBe(lesson.acts[0].id);
  });

  it('cleanup() kills the timeline and clears state', () => {
    const lesson = buildLesson(L => {
      L.act('A', A => { A.say('x'); });
    });
    window._graph = new EX.LessonGraph(lesson);

    EX.ActRunner.loadAct(lesson.acts[0]);
    EX.ActRunner.cleanup();

    expect(EX.ActRunner.masterTl).toBeNull();
    expect(EX.ActRunner.beatCues).toEqual([]);
    expect(EX.ActRunner._currentActId).toBeNull();
  });

  it('snapshotAct() runs viz actions instantly then kills timeline', () => {
    const lesson = buildLesson(L => {
      L.act('A', A => {
        A.say('x').do('showGrid');
      });
    });
    window._graph = new EX.LessonGraph(lesson);

    // Track viz:runActions emissions
    let vizCalled = false;
    EX.EventBus.on('viz:runActions', () => { vizCalled = true; });

    EX.ActRunner.snapshotAct(lesson.acts[0]);

    expect(vizCalled).toBe(true);
    expect(EX.ActRunner.masterTl).toBeNull(); // killed after snapshot
  });

  it('seek() clamps to act duration', () => {
    const lesson = buildLesson(L => {
      L.act('A', A => { A.say('one two three four five'); }); // 2s
    });
    const graph = new EX.LessonGraph(lesson);
    window._graph = graph;
    window._state = new EX.PlaybackState(graph);
    window._state.phase = 'playing';
    window._state.start();

    EX.ActRunner.loadAct(lesson.acts[0]);
    EX.ActRunner.seek(999); // way past end

    // Should be clamped to act duration
    expect(EX.ActRunner.masterTl.time()).toBeLessThanOrEqual(
      EX.ActRunner.getActDuration(lesson.acts[0])
    );
  });

  // Regression: scrolling used to re-play the intro animation because GSAP's
  // .time() on a paused timeline does not fire skipped .call()s, and child
  // tweens that ended before the new time were left mid-interpolation. seek()
  // must (a) instant-render missed beats and (b) force past children to their
  // end state so the scene reflects the post-seek moment, not the intro flash.
  it('seek() marks past beats as rendered and locks past tweens to end state', () => {
    const lesson = buildLesson(L => {
      L.act('A', A => {
        A.say('first beat narration about ten words long here');
        A.say('second beat narration about ten words long here');
        A.say('third beat narration about ten words long here');
      });
    });
    const graph = new EX.LessonGraph(lesson);
    window._graph = graph;
    window._state = new EX.PlaybackState(graph);
    window._state.phase = 'playing';
    window._state.start();

    EX.ActRunner.loadAct(lesson.acts[0]);
    const dur = EX.ActRunner.getActDuration(lesson.acts[0]);
    EX.ActRunner.seek(dur - 0.01);

    const beats = lesson.acts[0].beats;
    expect(EX.ActRunner._renderedBeats[beats[0].id]).toBe(true);
    expect(EX.ActRunner._renderedBeats[beats[1].id]).toBe(true);
    const children = EX.ActRunner.masterTl.getChildren();
    const pastChildren = children.filter(c =>
      typeof c.endTime === 'function' && c.endTime() <= dur - 0.01
    );
    pastChildren.forEach(c => expect(c.progress()).toBeCloseTo(1, 3));
  });
});

// ─────────────────────────────────────────────────────
//  Orchestrator — isStuck / recoverState
// ─────────────────────────────────────────────────────
describe('Orchestrator.isStuck', () => {
  it('returns false for normal playing state', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    window._graph = graph;
    window._state = state;

    state.phase = 'playing';
    // Simulate a running act
    EX.ActRunner.loadAct(lesson.acts[0]);
    EX.ActRunner._rafId = 1; // pretend ticker is alive

    expect(EX.Orchestrator.isStuck(state)).toBe(false);
  });

  it('returns true when phase is playing but ticker is dead', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    window._graph = graph;

    state.phase = 'playing';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;

    expect(EX.Orchestrator.isStuck(state)).toBe(true);
  });

  it('returns false during pending gate wait', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);

    state.phase = 'playing';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;
    EX.Orchestrator._pendingGateTimer = setTimeout(() => {}, 9999);

    expect(EX.Orchestrator.isStuck(state)).toBe(false);

    clearTimeout(EX.Orchestrator._pendingGateTimer);
    EX.Orchestrator._pendingGateTimer = null;
  });

  it('returns false for paused, ended, gate states', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);

    state.phase = 'paused';
    expect(EX.Orchestrator.isStuck(state)).toBe(false);

    state.phase = 'ended';
    expect(EX.Orchestrator.isStuck(state)).toBe(false);

    state.phase = 'gate';
    expect(EX.Orchestrator.isStuck(state)).toBe(false);
  });

  it('returns true for idle after lesson started', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);

    state.phase = 'idle';
    expect(EX.Orchestrator.isStuck(state)).toBe(true);
  });
});

describe('Orchestrator.recoverState', () => {
  it('forces state to paused and reloads the current act', () => {
    const lesson = buildLesson(L => {
      L.act('A1', A => { A.say('Hello world'); });
      L.act('A2', A => { A.say('Goodbye'); });
    });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    window._graph = graph;
    window._state = state;

    // Simulate being stuck mid-act
    state.phase = 'playing';
    state.start();
    state.localTime = 1.5;

    EX.Orchestrator.recoverState(graph, state);

    expect(state.phase).toBe('paused');
    expect(EX.ActRunner.masterTl).not.toBeNull();
    expect(EX.ActRunner._currentActId).toBe(state.getCurrentActId());
  });

  it('cancels pending gate timer on recovery', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    window._graph = graph;
    window._state = state;
    state.phase = 'playing';
    state.start();

    EX.Orchestrator._pendingGateTimer = setTimeout(() => {}, 9999);
    EX.Orchestrator._gateWaitToken = 5;

    EX.Orchestrator.recoverState(graph, state);

    expect(EX.Orchestrator._pendingGateTimer).toBeNull();
    expect(EX.Orchestrator._gateWaitToken).toBe(6); // incremented
  });
});

// ─────────────────────────────────────────────────────
//  Ticker death clears _rafId
// ─────────────────────────────────────────────────────
describe('ActRunner ticker', () => {
  it('clears _rafId when phase is not playing', () => {
    const lesson = buildLesson(L => { L.act('A', A => { A.say('x'); }); });
    const graph = new EX.LessonGraph(lesson);
    const state = new EX.PlaybackState(graph);
    window._graph = graph;
    window._state = state;

    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(lesson.acts[0]);
    EX.ActRunner.play(); // schedules rAF, sets _rafId

    expect(EX.ActRunner._rafId).not.toBeNull();

    // Change phase to paused — next tick should clear _rafId
    state.phase = 'paused';
    globalThis._flushRAF(1);

    expect(EX.ActRunner._rafId).toBeNull();
  });
});
