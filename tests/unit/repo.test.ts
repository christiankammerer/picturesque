// SPDX-License-Identifier: GPL-3.0-or-later
//
// Checks on the repository itself.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { ESLint } from 'eslint';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { checkMilestones } from '../../scripts/check-milestones.ts';

const root = join(import.meta.dirname, '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  license: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(p) ? [p] : [];
  });
}

describe('OVR-01 platform and stack', () => {
  it('is an Electron + React + TypeScript app built with electron-vite', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of ['electron', 'electron-vite', 'react', 'react-dom', 'typescript']) expect(all).toHaveProperty(dep);
  });
});

describe('OVR-07 licence', () => {
  it('LICENSE is the GPL-3.0 text', () => {
    const text = readFileSync(join(root, 'LICENSE'), 'utf8');
    expect(text).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(text).toContain('Version 3, 29 June 2007');
    expect(text).toContain('END OF TERMS AND CONDITIONS');
  });
  it('package.json says GPL-3.0-or-later', () => {
    expect(pkg.license).toBe('GPL-3.0-or-later');
  });
  it('every source file carries an SPDX header', () => {
    const missing = files(join(root, 'src'), /\.(ts|tsx)$/)
      .filter((f) => !readFileSync(f, 'utf8').startsWith('// SPDX-License-Identifier: '))
      .map((f) => relative(root, f));
    expect(missing).toEqual([]);
  });
});

describe('DST-07 version', () => {
  it('starts at 0.1.0', () => {
    expect(pkg.version).toBe('0.1.0');
  });
});

describe('RND-02 one renderer', () => {
  it('no code outside src/shared/render draws images', () => {
    const offenders = files(join(root, 'src'), /\.(ts|tsx)$/)
      .filter((f) => !relative(root, f).startsWith(join('src', 'shared', 'render')))
      .filter((f) => /\bdrawImage\s*\(/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});

describe('OVR-05 i18n', () => {
  it('the lint rule flags hard-coded user-facing strings in components', async () => {
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(
      'export function X() { return <button title="Save now">Export</button>; }\n',
      { filePath: join(root, 'src/renderer/src/Probe.tsx') },
    );
    const rules = result!.messages.map((m) => m.ruleId);
    expect(rules.filter((r) => r === 'i18next/no-literal-string')).toHaveLength(2);
  });
  it('the lint rule accepts translated strings', async () => {
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(
      "import { useTranslation } from 'react-i18next';\n" +
        "export function X() { const { t } = useTranslation(); return <button title={t('a')}>{t('b')}</button>; }\n",
      { filePath: join(root, 'src/renderer/src/Probe.tsx') },
    );
    expect(result!.messages.filter((m) => m.ruleId === 'i18next/no-literal-string')).toEqual([]);
  });
  it('every key the components use exists in the English catalogue', () => {
    const en = JSON.parse(readFileSync(join(root, 'src/renderer/src/i18n/locales/en.json'), 'utf8'));
    const keys = files(join(root, 'src/renderer'), /\.tsx?$/).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]!),
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
      expect(typeof value, key).toBe('string');
    }
  });
});

describe('milestone coverage (10-milestones.md)', () => {
  it('every requirement is in exactly one milestone, except EDT-01 and DST-09', () => {
    const { defined, problems } = checkMilestones(join(root, 'docs/spec'));
    expect(defined.length).toBeGreaterThan(100);
    expect(problems).toEqual([]);
  });
});

describe('OVR-10 libheif ships as a separate WASM file', () => {
  it('a build of the photo pipeline emits libheif as its own .wasm asset', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'picturesque-build-'));
    try {
      await build({
        configFile: false,
        root,
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true, rollupOptions: { input: join(root, 'src/shared/decode/photo-tasks.ts') } },
      });
      const out = files(outDir, /./).map((f) => relative(outDir, f));
      const wasm = out.filter((f) => /libheif.*\.wasm$/.test(f));
      expect(wasm).toHaveLength(1);
      expect(statSync(join(outDir, wasm[0]!)).size).toBeGreaterThan(1_000_000);
      expect(out.some((f) => /photo-worker.*\.js$/.test(f))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 60_000);
});
