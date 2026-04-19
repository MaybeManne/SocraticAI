/**
 * Build Tests — run build.sh on every content/example file,
 * verify output is valid HTML with all expected script blocks.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');

function build(contentFile, outputFile, audioFile) {
  const args = ['--mx', contentFile, outputFile];
  if (audioFile) args.push(audioFile);
  const cmd = `bash build.sh ${args.join(' ')}`;
  const result = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 15000 });
  return result;
}

function readOutput(outputFile) {
  return readFileSync(join(ROOT, outputFile), 'utf-8');
}

// ─────────────────────────────────────────────────────
//  Example builds
// ─────────────────────────────────────────────────────
const EXAMPLES = [
  'examples/01_cards.js',
  'examples/02_gates.js',
  'examples/03_viz_svg.js',
  'examples/04_viz_3d.js',
  'examples/05_full_lesson.js',
];

describe('build.sh — examples', () => {
  for (const ex of EXAMPLES) {
    const name = basename(ex, '.js');

    it(`builds ${name} without errors`, () => {
      const output = `dist/test_${name}.html`;
      const stdout = build(ex, output);
      expect(stdout).toContain('Built:');
      expect(stdout).not.toContain('ERROR');
    });

    it(`${name} output is valid HTML with all required sections`, () => {
      const output = `dist/test_${name}.html`;
      build(ex, output);
      const html = readOutput(output);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<style>');          // inlined CSS
      expect(html).toContain('MX.lesson');        // content script
      expect(html).toContain('EventBus');         // engine core
      expect(html).toContain('ActRunner');         // engine core
      expect(html).toContain('GateSystem');        // gates module
      expect(html).toContain('PlayerControls');    // controls module
      expect(html).toContain('ScrollSync');        // scroll-sync module
    });

    it(`${name} does not contain external file references`, () => {
      const output = `dist/test_${name}.html`;
      build(ex, output);
      const html = readOutput(output);

      // Should not have any src= references to local files (all inlined)
      expect(html).not.toMatch(/src="mobject\//);
      expect(html).not.toMatch(/src="engine\//);
      expect(html).not.toMatch(/src="content\//);
      // CSS link should be replaced with inline style
      expect(html).not.toContain('href="explainer-lib.css"');
    });
  }
});

// ─────────────────────────────────────────────────────
//  Main content build
// ─────────────────────────────────────────────────────
describe('build.sh — main content', () => {
  it('builds amc10a_2023_p15_v5 without audio', () => {
    const stdout = build(
      'content/amc10a_2023_p15_v5.js',
      'dist/test_amc_noaudio.html'
    );
    expect(stdout).toContain('Built:');

    const html = readOutput('dist/test_amc_noaudio.html');
    expect(html).toContain('MX.lesson');
    expect(html).toContain('nested_circles');
    // Should NOT contain audio data
    expect(html).not.toContain('L.audio');
  });

  it('builds amc10a_2023_p15_v5 with audio', () => {
    const audioFile = 'content/audio_nested_circles_the_2023_threshold.js';
    if (!existsSync(join(ROOT, audioFile))) {
      console.log('  (skipped — audio file not present)');
      return;
    }

    const stdout = build(
      'content/amc10a_2023_p15_v5.js',
      'dist/test_amc_audio.html',
      audioFile
    );
    expect(stdout).toContain('Built:');
    expect(stdout).toContain('audio');

    const html = readOutput('dist/test_amc_audio.html');
    expect(html).toContain('L.audio');
    expect(html).toContain('L.subtitles');
    // Audio HTML should be significantly larger
    expect(html.length).toBeGreaterThan(1_000_000);
  });
});

// ─────────────────────────────────────────────────────
//  Build output size sanity checks
// ─────────────────────────────────────────────────────
describe('build.sh — output sizes', () => {
  it('example outputs are between 100KB and 500KB', () => {
    for (const ex of EXAMPLES) {
      const name = basename(ex, '.js');
      const output = `dist/test_${name}.html`;
      build(ex, output);
      const html = readOutput(output);
      const sizeKB = html.length / 1024;
      expect(sizeKB).toBeGreaterThan(100);
      expect(sizeKB).toBeLessThan(500);
    }
  });
});
