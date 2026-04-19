/**
 * Minimal browser environment mock for loading the engine modules in Node.
 * Sets up window, document, gsap, katex, Audio, IntersectionObserver, and
 * requestAnimationFrame so the IIFE-based source files can execute.
 */

// ── window / globalThis ──
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

// ── DOM helpers ──
let _elId = 0;
function makeEl(tag) {
  const el = {
    _tag: tag || 'div',
    _id: null,
    _children: [],
    _attrs: {},
    _listeners: {},
    _classes: new Set(),
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    parentNode: null,
    draggable: false,
    disabled: false,
    type: '',
    value: '',
    tagName: (tag || 'DIV').toUpperCase(),

    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k] ?? null; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(child) {
      this._children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const i = this._children.indexOf(child);
      if (i >= 0) this._children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
    get firstChild() { return this._children[0] || null; },
    addEventListener(evt, fn, opts) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    },
    removeEventListener(evt, fn) {
      if (!this._listeners[evt]) return;
      this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
    },
    dispatchEvent(evt) {
      const fns = this._listeners[evt.type || evt] || [];
      fns.forEach(fn => fn(evt));
    },
    querySelector(sel) { return null; },
    querySelectorAll(sel) { return []; },
    closest(sel) { return null; },
    scrollIntoView() {},
    focus() {},
    cloneNode(deep) { return makeEl(this._tag); },
    classList: {
      _el: null,
      add(...cls) { cls.forEach(c => this._el._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._el._classes.delete(c)); },
      toggle(c, force) {
        if (force === undefined) force = !this._el._classes.has(c);
        if (force) this._el._classes.add(c); else this._el._classes.delete(c);
      },
      contains(c) { return this._el._classes.has(c); },
    },
    get className() { return [...this._classes].join(' '); },
    set className(v) {
      this._classes.clear();
      v.split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 40, right: 800, bottom: 40 }; },
  };
  el.classList._el = el;
  return el;
}

const _elements = {};
function getOrCreateEl(id) {
  if (!_elements[id]) {
    _elements[id] = makeEl('div');
    _elements[id]._id = id;
    _elements[id]._attrs.id = id;
  }
  return _elements[id];
}

globalThis.document = {
  getElementById(id) { return getOrCreateEl(id); },
  createElement(tag) { return makeEl(tag); },
  createElementNS(ns, tag) { return makeEl(tag); },
  addEventListener(evt, fn, opts) {},
  removeEventListener(evt, fn) {},
  querySelector(sel) { return null; },
  querySelectorAll(sel) { return []; },
  title: '',
  documentElement: { lang: 'en', dir: 'ltr' },
  body: { classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} } },
  elementFromPoint() { return null; },
};

// ── GSAP mock ──
function makeTl() {
  const children = [];
  const tl = {
    _paused: true,
    _time: 0,
    _duration: 0,
    _timeScale: 1,
    _callbacks: [],
    to(target, vars, pos) { children.push({ type: 'to', target, vars, pos }); return tl; },
    fromTo(target, from, to, pos) { children.push({ type: 'fromTo', target, from, to, pos }); return tl; },
    set(target, vars, pos) { children.push({ type: 'set', target, vars, pos }); return tl; },
    call(fn, args, pos) {
      children.push({ type: 'call', fn, args, pos });
      tl._callbacks.push({ fn, pos: pos || 0 });
      return tl;
    },
    play() { tl._paused = false; return tl; },
    pause() { tl._paused = true; return tl; },
    kill() { tl._paused = true; children.length = 0; },
    time(t) {
      if (t === undefined) return tl._time;
      tl._time = t;
      // Fire callbacks at or before this time
      tl._callbacks.forEach(cb => {
        if (typeof cb.pos === 'number' && cb.pos <= t) {
          try { cb.fn.apply(null, cb.args || []); } catch(e) {}
        }
      });
      return tl;
    },
    duration(d) { if (d === undefined) return tl._duration; tl._duration = d; return tl; },
    progress(p) {
      if (p === undefined) return tl._duration > 0 ? tl._time / tl._duration : 0;
      tl._time = p * tl._duration;
      // Fire all callbacks on progress(1)
      if (p >= 1) {
        tl._callbacks.forEach(cb => {
          try { cb.fn.apply(null, cb.args || []); } catch(e) {}
        });
      }
      return tl;
    },
    timeScale(s) { if (s === undefined) return tl._timeScale; tl._timeScale = s; return tl; },
    eventCallback() { return tl; },
    getChildren() { return children; },
  };
  return tl;
}

globalThis.gsap = {
  timeline(opts) { return makeTl(); },
  to(target, vars) { return makeTl(); },
  fromTo(target, from, to) { return makeTl(); },
  set(target, vars) { return makeTl(); },
  registerPlugin() {},
  killTweensOf() {},
  getTweensOf() { return []; },
};

// ── KaTeX mock ──
globalThis.katex = {
  render(latex, el, opts) { if (el) el.textContent = latex; },
};

// ── Audio mock ──
class MockAudio {
  constructor(src) {
    this.src = src || '';
    this.currentTime = 0;
    this.duration = 10;
    this.paused = true;
    this.ended = false;
    this.readyState = 4;
    this.playbackRate = 1;
    this.preload = '';
    this._listeners = {};
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener(evt, fn, opts) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
    // Auto-fire canplaythrough for test convenience
    if (evt === 'canplaythrough') setTimeout(() => fn(), 0);
  }
  removeEventListener(evt, fn) {
    if (!this._listeners[evt]) return;
    this._listeners[evt] = this._listeners[evt].filter(f => f !== fn);
  }
}
globalThis.Audio = MockAudio;
globalThis.window.Audio = MockAudio;

// ── IntersectionObserver mock ──
globalThis.IntersectionObserver = class {
  constructor(cb, opts) { this._cb = cb; this._entries = []; }
  observe(el) {}
  unobserve(el) {}
  disconnect() {}
};

// ── rAF mock ──
let _rafId = 0;
const _rafCallbacks = new Map();
globalThis.requestAnimationFrame = function(fn) {
  const id = ++_rafId;
  _rafCallbacks.set(id, fn);
  return id;
};
globalThis.cancelAnimationFrame = function(id) {
  _rafCallbacks.delete(id);
};
// Helper to flush pending rAF callbacks (for tests)
globalThis._flushRAF = function(count) {
  count = count || 1;
  for (let i = 0; i < count; i++) {
    const cbs = [..._rafCallbacks.entries()];
    _rafCallbacks.clear();
    cbs.forEach(([id, fn]) => fn(performance.now()));
  }
};

// ── Reset helper for between tests ──
export function resetBrowserMock() {
  // Clear element cache
  for (const k in _elements) delete _elements[k];
  // Reset rAF
  _rafCallbacks.clear();
  _rafId = 0;
  // Clear any window.LESSON / EX / MX
  delete globalThis.window.LESSON;
  delete globalThis.window.EX;
  delete globalThis.window.MX;
  delete globalThis.window.EXPLAINER_VIZ;
  delete globalThis.window._graph;
  delete globalThis.window._state;
  delete globalThis.window._collapseHero;
}

export { makeEl, getOrCreateEl, MockAudio };
