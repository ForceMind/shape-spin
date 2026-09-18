/**
 * Validates every known level's structure and supply/demand balance, and replays
 * authored witnesses through the production engine. Levels without a witness are
 * reported as such; they are not silently counted as solved.
 */
import { LEGACY_LEVELS } from '../src/content/legacyLevels';
import { validateLevel } from '../src/core/validation';
import { replay } from '../src/core/replay';

let solved = 0;
let missing = 0;
let failed = 0;

for (const level of LEGACY_LEVELS) {
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

console.log(`\nValidated: ${LEGACY_LEVELS.length} levels | solved ${solved} | missing witness ${missing} | failed ${failed}`);
if (failed > 0) process.exit(1);
if (missing > 0) {
  console.log('Note: missing witnesses are expected before stage 3 completes. This run reports them honestly instead of failing.');
}
