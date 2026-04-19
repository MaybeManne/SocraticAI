/**
 * Notebook, KaTeX helper (K), and FillIn validator unit tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock, makeEl } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let EX;
beforeEach(() => { resetBrowserMock(); EX = loadAll().EX; });

// ─────────────────────────────────────────────────────
//  K (KaTeX helpers)
// ─────────────────────────────────────────────────────
describe('K.inline', () => {
  it('renders LaTeX into an element via katex.render', () => {
    const el = makeEl('span');
    EX.K.inline('x^2', el);
    expect(el.textContent).toBe('x^2');
  });
});

describe('K.display', () => {
  it('renders display-mode LaTeX', () => {
    const el = makeEl('div');
    EX.K.display('\\frac{1}{2}', el);
    expect(el.textContent).toBe('\\frac{1}{2}');
  });
});

describe('K.mixed', () => {
  it('renders plain text', () => {
    const el = makeEl('div');
    EX.K.mixed('Hello world', el);
    expect(el._children.length).toBeGreaterThan(0);
  });

  it('renders inline LaTeX delimited by $...$', () => {
    const el = makeEl('div');
    EX.K.mixed('Area is $\\pi r^2$ exactly', el);
    // Should have multiple children: text + latex span + text
    expect(el._children.length).toBeGreaterThanOrEqual(2);
  });

  it('renders display LaTeX delimited by $$...$$', () => {
    const el = makeEl('div');
    EX.K.mixed('Formula: $$x = 5$$', el);
    expect(el._children.length).toBeGreaterThanOrEqual(2);
  });

  it('renders **bold** markdown', () => {
    const el = makeEl('div');
    EX.K.mixed('This is **bold** text', el);
    const html = el._children.map(c => c.innerHTML || c.textContent).join('');
    expect(html).toContain('<b>bold</b>');
  });

  it('handles malformed LaTeX without crashing', () => {
    const el = makeEl('div');
    // Our mock katex.render just sets textContent, so this won't throw
    // In real katex with throwOnError: false, it would render error message
    expect(() => EX.K.mixed('Bad: $\\invalid{$ end', el)).not.toThrow();
  });
});

describe('K.renderWithBlank', () => {
  it('replaces [___] with an input element', () => {
    const el = makeEl('div');
    EX.K.renderWithBlank('What is [___]?', el, { width: 80, placeholder: '?' });
    const inputs = el._children.filter(c => c._tag === 'input');
    expect(inputs.length).toBe(1);
    expect(inputs[0].style.width).toBe('80px');
  });

  it('handles multiple blanks', () => {
    const el = makeEl('div');
    EX.K.renderWithBlank('[___] + [___] = 4', el, { width: 50, placeholder: '?' });
    const inputs = el._children.filter(c => c._tag === 'input');
    expect(inputs.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────
//  FillIn validator
// ─────────────────────────────────────────────────────
describe('FillIn.normalize', () => {
  it('lowercases and strips whitespace', () => {
    expect(EX.FillIn.normalize('  Hello World  ')).toBe('helloworld');
  });

  it('converts pi variants to unicode pi', () => {
    expect(EX.FillIn.normalize('4pi')).toBe('4\u03c0');
    expect(EX.FillIn.normalize('4\\pi')).toBe('4\u03c0');
    expect(EX.FillIn.normalize('4PI')).toBe('4\u03c0');
  });

  it('converts * to multiplication sign', () => {
    expect(EX.FillIn.normalize('3*4')).toBe('3\u00d74');
  });

  it('strips LaTeX commands and braces', () => {
    expect(EX.FillIn.normalize('\\frac{1}{2}')).toBe('1/2');
  });
});

describe('FillIn.validate', () => {
  it('returns true when input matches an accepted answer', () => {
    expect(EX.FillIn.validate('4pi', ['4\\pi', '4pi'])).toBe(true);
  });

  it('returns false when input does not match', () => {
    expect(EX.FillIn.validate('5pi', ['4\\pi', '4pi'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(EX.FillIn.validate('4PI', ['4pi'])).toBe(true);
  });

  it('ignores whitespace differences', () => {
    expect(EX.FillIn.validate(' 4 pi ', ['4pi'])).toBe(true);
  });
});

// ─────────────────────────────────────────────────────
//  Notebook
// ─────────────────────────────────────────────────────
describe('Notebook', () => {
  beforeEach(() => { EX.Notebook.init(); });

  it('appendBeat adds element to container', () => {
    const el = makeEl('div');
    EX.Notebook.appendBeat('b1', el);
    expect(EX.Notebook.cards['b1']).toBe(el);
  });

  it('appendBeat ignores duplicates', () => {
    const el1 = makeEl('div');
    const el2 = makeEl('div');
    EX.Notebook.appendBeat('b1', el1);
    EX.Notebook.appendBeat('b1', el2); // duplicate
    expect(EX.Notebook.cards['b1']).toBe(el1);
  });

  it('appendMilestone adds element with milestone-card class', () => {
    const el = makeEl('div');
    EX.Notebook.appendMilestone('ms1', el);
    expect(EX.Notebook.cards['ms1']).toBe(el);
    expect(el._classes.has('milestone-card')).toBe(true);
  });

  it('activate marks previous cards as past', () => {
    const el1 = makeEl('div');
    const el2 = makeEl('div');
    EX.Notebook.appendBeat('b1', el1);
    EX.Notebook.appendBeat('b2', el2);
    // appendBeat uses rAF to add "entered" — flush it
    globalThis._flushRAF(1);
    EX.Notebook.activate('b2');
    expect(el1._classes.has('past')).toBe(true);
    expect(el2._classes.has('active')).toBe(true);
  });

  it('clear() empties everything', () => {
    EX.Notebook.appendBeat('b1', makeEl('div'));
    EX.Notebook.clear();
    expect(Object.keys(EX.Notebook.cards)).toHaveLength(0);
  });
});
