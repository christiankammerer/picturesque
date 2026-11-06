// SPDX-License-Identifier: GPL-3.0-or-later
//
// Checks docs/spec/10-milestones.md: every requirement ID defined in the spec
// appears in exactly one milestone, except EDT-01 and DST-09, which are split
// across two.
//
//   node scripts/check-milestones.ts

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPLIT_IDS = new Set(['EDT-01', 'DST-09']);

export interface CoverageProblem {
  id: string;
  milestones: string[];
}

export function checkMilestones(specDir: string): { defined: string[]; problems: CoverageProblem[] } {
  const defined = new Set<string>();
  for (const file of readdirSync(specDir).filter((f) => f.endsWith('.md'))) {
    for (const m of readFileSync(join(specDir, file), 'utf8').matchAll(/^\*\*([A-Z]{3}-\d{2})\*\*/gm)) {
      defined.add(m[1]!);
    }
  }

  const where = new Map<string, string[]>();
  const text = readFileSync(join(specDir, '10-milestones.md'), 'utf8');
  for (const section of text.split(/^### /m).slice(1)) {
    const name = section.split(' ')[0]!;
    const line = section.split('\n').find((l) => l.startsWith('**Requirements:**'));
    if (!line) continue;
    for (const id of expand(line)) where.set(id, [...(where.get(id) ?? []), name]);
  }

  const problems: CoverageProblem[] = [];
  for (const id of [...defined].sort()) {
    const ms = where.get(id) ?? [];
    const expected = SPLIT_IDS.has(id) ? 2 : 1;
    if (ms.length !== expected) problems.push({ id, milestones: ms });
  }
  for (const id of where.keys()) {
    if (!defined.has(id)) problems.push({ id, milestones: where.get(id)! });
  }
  return { defined: [...defined].sort(), problems };
}

/** IDs in a Requirements line, with ranges such as "MOD-04–MOD-09" expanded. */
function expand(line: string): string[] {
  const ids: string[] = [];
  for (const m of line.matchAll(/([A-Z]{3})-(\d{2})(?:\s*[–-]\s*\1-(\d{2}))?/g)) {
    const from = Number(m[2]);
    const to = m[3] ? Number(m[3]) : from;
    for (let n = from; n <= to; n++) ids.push(`${m[1]}-${String(n).padStart(2, '0')}`);
  }
  return ids;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const specDir = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/spec');
  const { defined, problems } = checkMilestones(specDir);
  for (const p of problems) {
    console.error(`${p.id}: in ${p.milestones.length ? p.milestones.join(', ') : 'no milestone'}`);
  }
  console.log(`${defined.length} requirements, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}
