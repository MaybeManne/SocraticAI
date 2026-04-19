/**
 * PlayerControls unit tests — formatTime, speed cycling, toggle logic.
 * These test the PlayerControls module in isolation by loading the engine
 * and directly calling methods.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let MX, EX;

function setupLesson() {
  const lesson = MX.lesson('Controls Test', L => {
    L.act('Act 1', A => { A.say('Hello world from act one.'); });
    L.act('Act 2', A => { A.say('Goodbye world from act two.'); });
  });
  const graph = new EX.LessonGraph(lesson);
  const state = new EX.PlaybackState(graph);
  window._graph = graph;
  window._state = state;
  EX.AudioManager.init(graph);
  EX.Subtitles.init(graph);
  EX.ScrollSync.init();
  EX.Orchestrator.init(graph, state);
  EX.PlayerControls.init(graph, state);
  return { lesson, graph, state };
}

beforeEach(() => {
  resetBrowserMock();
  ({ MX, EX } = loadAll());
});

describe('PlayerControls.toggle', () => {
  it('starts lesson on first toggle', () => {
    const { state } = setupLesson();
    EX.PlayerControls.toggle();
    expect(EX.PlayerControls.firstDone).toBe(true);
    expect(state.phase).toBe('playing');
  });

  it('pauses when playing', () => {
    const { state } = setupLesson();
    EX.PlayerControls.toggle(); // start
    EX.PlayerControls.toggle(); // pause
    expect(state.phase).toBe('paused');
    expect(EX.PlayerControls.playing).toBe(false);
  });

  it('resumes when paused', () => {
    const { state } = setupLesson();
    EX.PlayerControls.toggle(); // start
    EX.PlayerControls.toggle(); // pause
    EX.PlayerControls.toggle(); // resume
    expect(state.phase).toBe('playing');
    expect(EX.PlayerControls.playing).toBe(true);
  });

  it('restarts from ended state', () => {
    const { state } = setupLesson();
    state.phase = 'ended';
    EX.PlayerControls.firstDone = true;
    EX.PlayerControls.toggle();
    expect(state.phase).toBe('playing');
  });

  it('dismisses gate and advances on toggle during gate', () => {
    const { state } = setupLesson();
    EX.PlayerControls.toggle(); // start
    state.phase = 'gate';
    EX.PlayerControls.toggle(); // dismiss gate
    // Should have forced out of gate
    expect(state.phase).not.toBe('gate');
  });

  it('recovers from stuck state', () => {
    const { state } = setupLesson();
    EX.PlayerControls.firstDone = true;
    state.phase = 'playing';
    EX.ActRunner.masterTl = null;
    EX.ActRunner._rafId = null;
    EX.PlayerControls.toggle();
    // After recovery, should be paused
    expect(state.phase).toBe('paused');
  });
});

describe('PlayerControls.start', () => {
  it('clears notebook and viz on replay', () => {
    const { state } = setupLesson();
    let notebookCleared = false;
    let vizReset = false;
    EX.EventBus.on('notebook:clear', () => { notebookCleared = true; });
    EX.EventBus.on('viz:reset', () => { vizReset = true; });

    EX.PlayerControls.start();
    expect(notebookCleared).toBe(true);
    expect(vizReset).toBe(true);
    expect(state.phase).toBe('playing');
  });
});

describe('PlayerControls callbacks', () => {
  it('onGateEnter sets playing=false without locking scrubber', () => {
    setupLesson();
    EX.PlayerControls.playing = true;
    EX.PlayerControls.onGateEnter();
    expect(EX.PlayerControls.playing).toBe(false);
    expect(EX.PlayerControls._scrubberLocked).toBe(false);
  });

  it('onGateExit sets playing=true', () => {
    setupLesson();
    EX.PlayerControls.onGateExit();
    expect(EX.PlayerControls.playing).toBe(true);
  });

  it('onLessonEnd sets playing=false', () => {
    setupLesson();
    EX.PlayerControls.playing = true;
    EX.PlayerControls.onLessonEnd();
    expect(EX.PlayerControls.playing).toBe(false);
  });
});

describe('Speed cycling', () => {
  it('cycles through speed presets', () => {
    setupLesson();
    const speeds = EX.PlayerControls.speeds;
    expect(EX.PlayerControls.speedIdx).toBe(2); // starts at 1x
    expect(speeds[2]).toBe(1);

    // Simulate cycling
    EX.PlayerControls.speedIdx = (EX.PlayerControls.speedIdx + 1) % speeds.length;
    expect(speeds[EX.PlayerControls.speedIdx]).toBe(1.25);
  });
});
