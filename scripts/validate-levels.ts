/**
 * Release gate: validates all generated campaign levels from the JSON content
 * pack and replays every witness through the production engine. This script is
 * intentionally independent of browser runtime loading.
 */
import { readFileSync } from 'node:fs';
import { validateLevel } from '../src/core/validation';
import { replay } from '../src/core/replay';
import type { LevelDefinition } from '../src/core/types';

const raw = readFileSync(new URL('../src/content/generated/campaign.json', import.meta.url), 'utf8');
const decoded: unknown = JSON.parse(raw);
if (!Array.isArray(decoded)) {
  console.error('Campaign content pack is not an array');
  process.exit(1);
}
const campaignLevels = decoded as LevelDefinition[];

let solved = 0;
let missing = 0;
let failed = 0;

if (campaignLevels.length !== 200) {
  console.error(`Expected exactly 200 campaign levels, found ${campaignLevels.length}`);
  process.exit(1);
}

for (const level of campaignLevels) {
  validateLevel(level);
  if (level.witness.length === 0) {
    missing += 1;
    console.log(`[missing-witness] ${level.levelId} (#${level.displayNumber})`);
    continue;
  }
  const result = replay(level, level.witness);
  if (result.ok && result.state.phase === 'won') {
    solved += 1;
    console.log(`[solvable] ${level.levelId} (#${level.displayNumber}) — ${level.witness.length} actions`);
  } else {
    failed += 1;
    console.log(`[witness-failed] ${level.levelId} (#${level.displayNumber})`);
  }
}

console.log(`\nValidated: ${campaignLevels.length} levels | solved ${solved} | missing witness ${missing} | failed ${failed}`);
if (failed > 0 || missing > 0) process.exit(1);
