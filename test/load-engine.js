/**
 * Loads the MX + engine modules in the correct order into the global scope.
 * Must be called AFTER browser-mock sets up the globals.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');

const MX_FILES = [
  'mobject/mobject.js',
  'mobject/anim.js',
  'mobject/dsl.js',
];

const ENGINE_FILES = [
  'engine/core.js',
  'engine/notebook.js',
  'engine/viz-panel.js',
  'engine/audio.js',
  'engine/subtitles.js',
  'engine/cards.js',
  'engine/gates.js',
  'engine/controls.js',
  'engine/scroll-sync.js',
  'engine/init.js',
];

export function loadMX() {
  for (const f of MX_FILES) {
    const code = readFileSync(join(ROOT, f), 'utf-8');
    // eslint-disable-next-line no-eval
    (0, eval)(code);
  }
  return globalThis.window.MX;
}

export function loadEngine() {
  // Engine files EXCEPT init.js (which boots the lesson and needs LESSON data)
  const files = ENGINE_FILES.filter(f => !f.endsWith('init.js'));
  for (const f of files) {
    const code = readFileSync(join(ROOT, f), 'utf-8');
    (0, eval)(code);
  }
  return globalThis.window.EX;
}

export function loadInit() {
  const code = readFileSync(join(ROOT, 'engine/init.js'), 'utf-8');
  (0, eval)(code);
}

export function loadAll() {
  loadMX();
  loadEngine();
  return { MX: globalThis.window.MX, EX: globalThis.window.EX };
}
