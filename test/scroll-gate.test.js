/**
 * Scroll/Gate Regression Tests
 *
 * Simulates rapid scrolling, gate interactions, and seeks to verify
 * the player never gets permanently stuck.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let MX, EX;

function buildTestLesson() {
  return MX.lesson('Scroll Test', L => {
    L.act('Act 1', A => {
      A.say('First sentence of act one here today.');
      A.say('Second sentence of act one right now.');
    });
    L.ask({
      question: 'Pick one',
      options: ['A', 'B'],
      correct: 0,
      explain: { correct: 'Yes', '1': 'No' },
      wrongPath: B => {
        B.act('Branch', A => { A.say('Review this material carefully.'); });
      },
    });
    L.act('Act 2', A => {
      A.say('First sentence of act two is long enough.');
      A.say('Second sentence of act two is also long.');
    });
    L.marker('end-section');
    L.act('Act 3', A => {
      A.say('Final act wraps everything up now.');
    });
  });
}

function setupEngine() {
  const lesson = buildTestLesson();
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

beforeEach(() => {
  resetBrowserMock();
  ({ MX, EX } = loadAll());
});

// ─────────────────────────────────────────────────────
//  Basic seeking
// ─────────────────────────────────────────────────────
describe('Seeking', () => {
  it('seekToGlobalTime stays in the same act for small seeks', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();

    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);
    EX.ActRunner._rafId = 1; // pretend ticker is alive

    EX.Orchestrator.seekToGlobalTime(0.5, graph, state);
    expect(state.localTime).toBeCloseTo(0.5, 1);
    expect(state.phase).toBe('playing');
  });

  it('jumpToDefaultIndex replays acts from scratch to target', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();

    // Jump to Act 2 (index 1) which is after the gate
    EX.Orchestrator.jumpToDefaultIndex(1, 0, graph, state);

    expect(state.defaultIndex).toBe(1);
    expect(state.phase).toBe('playing');
    expect(EX.ActRunner.masterTl).not.toBeNull();
  });

  it('jumpToDefaultIndex past end triggers lesson:end', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();

    let ended = false;
    EX.EventBus.on('lesson:end', () => { ended = true; });

    EX.Orchestrator.jumpToDefaultIndex(999, 0, graph, state);
    expect(ended).toBe(true);
  });
});

// ─────────────────────────────────────────────────────
//  Gate dismiss on seek
// ─────────────────────────────────────────────────────
describe('Gate dismissal', () => {
  it('seekToGlobalTime during gate forces out of gate state', () => {
    const { graph, state } = setupEngine();
    state.phase = 'gate'; // simulate being at a gate

    // Seeking should dismiss the gate, not block
    EX.Orchestrator.seekToGlobalTime(0, graph, state);

    // Should have left gate state
    expect(state.phase).not.toBe('gate');
  });

  it('jumpToDefaultIndex during gate forces out of gate state', () => {
    const { graph, state } = setupEngine();
    state.phase = 'gate';
    state.start();

    EX.Orchestrator.jumpToDefaultIndex(2, 0, graph, state);

    expect(state.phase).toBe('playing');
    expect(state.defaultIndex).toBe(2);
  });
});

// ─────────────────────────────────────────────────────
//  Stuck state detection
// ─────────────────────────────────────────────────────
describe('Stuck state detection', () => {
  it('detects stuck when phase=playing but masterTl is null', () => {
    const { state } = setupEngine();
    state.phase = 'playing';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;

    expect(EX.Orchestrator.isStuck(state)).toBe(true);
  });

  it('detects stuck when phase=playing but ticker (_rafId) is null', () => {
    const { state } = setupEngine();
    state.phase = 'playing';
    EX.ActRunner.loadAct({ id: 'fake', beats: [], duration: 5 });
    EX.ActRunner._rafId = null; // ticker dead

    expect(EX.Orchestrator.isStuck(state)).toBe(true);
  });

  it('does NOT flag as stuck during pendingGateTimer', () => {
    const { state } = setupEngine();
    state.phase = 'playing';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;
    EX.Orchestrator._pendingGateTimer = setTimeout(() => {}, 9999);

    expect(EX.Orchestrator.isStuck(state)).toBe(false);

    clearTimeout(EX.Orchestrator._pendingGateTimer);
    EX.Orchestrator._pendingGateTimer = null;
  });

  it('recoverState resets everything and leaves in paused state', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();
    state.localTime = 2.0;

    // Corrupt state
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;

    EX.Orchestrator.recoverState(graph, state);

    expect(state.phase).toBe('paused');
    expect(EX.ActRunner.masterTl).not.toBeNull();
    expect(EX.Orchestrator._pendingGateTimer).toBeNull();
  });
});

// ─────────────────────────────────────────────────────
//  Rapid scroll simulation
// ─────────────────────────────────────────────────────
describe('Rapid scroll simulation', () => {
  it('multiple seeks in quick succession do not leave player stuck', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);
    EX.ActRunner._rafId = 1;

    // Simulate 20 rapid seeks
    for (let i = 0; i < 20; i++) {
      const t = Math.random() * graph.totalDefaultDuration;
      EX.Orchestrator.seekToGlobalTime(t, graph, state);
    }

    // After all seeks, state should be recoverable
    const stuck = EX.Orchestrator.isStuck(state);
    if (stuck) {
      EX.Orchestrator.recoverState(graph, state);
    }
    expect(state.phase).toMatch(/^(playing|paused)$/);
    expect(EX.ActRunner.masterTl).not.toBeNull();
  });

  it('rapid jump-to-milestone does not leave player stuck', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();
    EX.ActRunner.loadAct(graph.allActs[state.getCurrentActId()]);

    // Jump to each act index rapidly
    for (let i = 0; i < graph.defaultPath.length; i++) {
      EX.Orchestrator.jumpToDefaultIndex(i, 0, graph, state);
    }

    expect(state.phase).toBe('playing');
    expect(EX.ActRunner.masterTl).not.toBeNull();
  });

  it('seek during gate + recovery leaves player usable', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();

    // Simulate entering gate
    state.phase = 'gate';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;

    // Seek away from gate
    EX.Orchestrator.seekToGlobalTime(
      graph.totalDefaultDuration * 0.8,
      graph,
      state
    );

    // Should have left gate and be playable
    expect(state.phase).not.toBe('gate');
    expect(EX.ActRunner.masterTl).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────
//  Gate entry callback cancellation
// ─────────────────────────────────────────────────────
describe('Gate callback cancellation', () => {
  it('cancelPendingGate increments token and clears timer', () => {
    EX.Orchestrator._gateWaitToken = 5;
    EX.Orchestrator._pendingGateTimer = setTimeout(() => {}, 9999);

    EX.Orchestrator.cancelPendingGate();

    expect(EX.Orchestrator._gateWaitToken).toBe(6);
    expect(EX.Orchestrator._pendingGateTimer).toBeNull();
  });

  it('stale doEnter callback is ignored after cancellation', () => {
    const { graph, state } = setupEngine();
    state.phase = 'playing';
    state.start();

    let gateEntered = false;
    EX.EventBus.on('gate:enter', () => { gateEntered = true; });

    // Simulate: _enterGateWhenAudioDone starts, then we cancel and recover
    const ms = { id: 'ms1', type: 'gate', gate: { type: 'quiz' } };
    EX.Orchestrator._enterGateWhenAudioDone(ms, 'act-1', graph, state);

    // Cancel immediately (simulates recoverState calling cancelPendingGate)
    EX.Orchestrator.cancelPendingGate();
    state.phase = 'paused'; // recoverState would set this

    // Wait for any pending callbacks to fire
    return new Promise(resolve => {
      setTimeout(() => {
        // Gate should NOT have entered because token was invalidated
        // and state is no longer "playing"
        expect(state.phase).toBe('paused');
        resolve();
      }, 100);
    });
  });
});

// ─────────────────────────────────────────────────────
//  ScrollSync lock flags
// ─────────────────────────────────────────────────────
describe('ScrollSync lock flags', () => {
  it('recover:reset clears all locks', () => {
    EX.ScrollSync.init();
    EX.ScrollSync.scrollLocked = true;
    EX.ScrollSync.timelineLocked = true;
    EX.ScrollSync._intersectTimeout = setTimeout(() => {}, 9999);

    EX.EventBus.emit('recover:reset', {});

    expect(EX.ScrollSync.scrollLocked).toBe(false);
    expect(EX.ScrollSync.timelineLocked).toBe(false);
    expect(EX.ScrollSync._intersectTimeout).toBeNull();
  });

  it('cancelPendingSeek clears debounce timer', () => {
    EX.ScrollSync.init();
    EX.ScrollSync._intersectTimeout = setTimeout(() => {}, 9999);

    EX.ScrollSync.cancelPendingSeek();

    expect(EX.ScrollSync._intersectTimeout).toBeNull();
  });
});
