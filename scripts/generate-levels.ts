/**
 * Generates the full 200-level campaign. Uses deterministic seeded generation
 * with the same connectivity rules as the legacy demo. Each level is validated
 * by replaying its witness through the production engine.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { LEGACY_LEVELS, AUTHORED_SOURCES, GENERATED_SOURCES } from '../src/content/legacyLevels';
import { validateLevel } from '../src/core/validation';
import { seedWitness } from '../src/core/solver';
import { replay } from '../src/core/replay';
import { getLegalActions } from '../src/core/engine';
import { typeIdFromLegacyKey, LEGACY_TYPE_KEYS } from '../src/content/pieceTypes';
import type { LegacyTypeKey, LevelDefinition, PlayerAction } from '../src/core/types';
import { RULE_VERSION } from '../src/core/types';
import { cellsFromMask, LAYOUT_TEMPLATES, levelFingerprint, templateForCampaignLevel } from '../src/levels/templates';

const LAYOUT_TEMPLATE_IDS = new Set(LAYOUT_TEMPLATES.map((template) => template.id));

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = values[index];
    values[index] = values[swapIndex] as T;
    values[swapIndex] = value as T;
  }
  return values;
}

function positionsFromMask(mask: readonly string[]): { row: number; column: number }[] {
  return mask.flatMap((row, rowIndex) => [...row].flatMap((value, columnIndex) => value === '1' ? [{ row: rowIndex, column: columnIndex }] : []));
}

function oldSelectable(pieces: readonly ({ row: number; column: number; index: number; removed: boolean })[]): number[] {
  const byPosition = new Map(pieces.map((piece) => [`${piece.row},${piece.column}`, piece]));
  const open = new Set<number>();
  const queue: typeof pieces[number][] = [];
  for (const piece of pieces) {
    if (piece.row === 0 && piece.removed) { open.add(piece.index); queue.push(piece); }
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const piece = queue[qi]; if (!piece) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const n = byPosition.get(`${piece.row + dr},${piece.column + dc}`);
      if (n?.removed && !open.has(n.index)) { open.add(n.index); queue.push(n); }
    }
  }
  const DIRECTIONS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return pieces.filter((piece) => !piece.removed && (piece.row === 0 || DIRECTIONS.some((dir) => {
    const n = byPosition.get(`${piece.row + dir[0]},${piece.column + dir[1]}`);
    return n !== undefined && open.has(n.index);
  }))).map((piece) => piece.index);
}

function generateLevel(displayNumber: number, seed: number): LevelDefinition | null {
  const random = mulberry32(seed);
  const chapter = Math.ceil(displayNumber / 20);
  const difficulty = Math.min(10, chapter);
  const template = templateForCampaignLevel(displayNumber);
  // Stable authored topology; variations come from type/order seed rather than
  // random walls, so a chapter visibly teaches distinct structures.
  const mask = template.mask;
  const positions = cellsFromMask(mask);
  if (positions.length < 6 || positions.length > 30) return null;
  const paletteSize = Math.min(9, 3 + Math.floor(difficulty / 2));
  const palette = LEGACY_TYPE_KEYS.slice(0, paletteSize);
  const keys = shuffle(Array.from({ length: positions.length }, (_, i) => palette[i % palette.length]), random);
  const sandbox = positions.map((pos, i) => ({ ...pos, index: i, removed: false }));
  const plan: number[] = [];
  while (sandbox.some((p) => !p.removed)) {
    const options = oldSelectable(sandbox);
    if (options.length === 0) return null;
    const selected = options[Math.floor(random() * options.length)];
    if (selected === undefined) return null;
    const piece = sandbox[selected];
    if (!piece) return null;
    piece.removed = true;
    plan.push(selected);
  }
  const windowSize = 3;
  const goalOrder: number[] = [];
  for (let i = 0; i < plan.length; i += windowSize) goalOrder.push(...shuffle(plan.slice(i, i + windowSize), random));
  const goals: LegacyTypeKey[][] = [];
  for (let i = 0; i < goalOrder.length; i += 3) goals.push(goalOrder.slice(i, i + 3).map((pi) => keys[pi] as LegacyTypeKey));
  const levelId = `campaign-${String(displayNumber).padStart(3, '0')}`;
  const cells = positions;
  const pieces = cells.map((pos, i) => ({ ...pos, pieceId: `${levelId}-piece-${String(i).padStart(2, '0')}`, typeId: typeIdFromLegacyKey(keys[i] as LegacyTypeKey) }));
  const targetRows = goals.map((slots, i) => ({ rowId: `${levelId}-target-${i}`, slots: slots.map(typeIdFromLegacyKey) }));
  const level: LevelDefinition = {
    levelId, contentVersion: 1, ruleVersion: RULE_VERSION,
    displayNumber, chapter, titleKey: `level.${String(displayNumber).padStart(3, '0')}.title`,
    cells, pieces, targetRows,
    initialSpins: Math.max(0, 3 - Math.floor(difficulty / 4)),
    seed, generatorVersion: 2,
    tags: ['generated', `chapter-${chapter}`, ...template.tags],
    parSpins: Math.max(0, 2 - Math.floor(difficulty / 5)),
    witness: [],
  };
  const validated = seedWitness(level, plan);
  if (!validated) return null;
  return { ...level, witness: validated };
}

const allLevels: LevelDefinition[] = [...LEGACY_LEVELS];
const fingerprints = new Set(allLevels.map(levelFingerprint));
const templateCounts: Record<string, number> = {};
let rejectedDuplicate = 0;
let totalAttempts = 0;
for (let n = 9; n <= 200; n++) {
  let level: LevelDefinition | null = null;
  for (let attempt = 0; attempt < 100 && !level; attempt++) {
    totalAttempts += 1;
    const candidate = generateLevel(n, n * 1000 + attempt);
    if (!candidate) continue;
    const fingerprint = levelFingerprint(candidate);
    if (fingerprints.has(fingerprint)) {
      rejectedDuplicate += 1;
      continue;
    }
    fingerprints.add(fingerprint);
    level = candidate;
  }
  if (!level) { console.error(`Failed to generate unique level ${n}`); process.exit(1); }
  const template = level.tags.find((tag) => LAYOUT_TEMPLATE_IDS.has(tag)) ?? 'unknown';
  templateCounts[template] = (templateCounts[template] ?? 0) + 1;
  allLevels.push(level);
}

// Required fixed-seed quality sample; this is diagnostic-only and never changes
// accepted campaign content. Budget is deterministic (100 tries per seed).
const seedSample = { seeds: 1000, valid: 0, duplicates: 0, budgetExhausted: 0, fallback: 0 };
const sampleFingerprints = new Set<string>();
for (let sample = 0; sample < seedSample.seeds; sample += 1) {
  const displayNumber = 9 + (sample % 192);
  let candidate: LevelDefinition | null = null;
  for (let attempt = 0; attempt < 100 && !candidate; attempt += 1) {
    candidate = generateLevel(displayNumber, 0x51A7_0000 + sample * 100 + attempt);
  }
  if (!candidate) {
    seedSample.budgetExhausted += 1;
    continue;
  }
  seedSample.valid += 1;
  const fingerprint = levelFingerprint(candidate);
  if (sampleFingerprints.has(fingerprint)) seedSample.duplicates += 1;
  else sampleFingerprints.add(fingerprint);
}

for (const level of allLevels) validateLevel(level);

mkdirSync('src/content/generated', { recursive: true });
mkdirSync('public', { recursive: true });
const campaignJson = JSON.stringify(allLevels);
writeFileSync('src/content/generated/campaign.json', campaignJson);
// The browser runtime fetches this static asset; keep it synchronized with source data.
writeFileSync('public/campaign.json', campaignJson);
// Runtime pack starts empty and is populated from campaign.json/storage by main.ts.
writeFileSync('src/content/generated/campaign.ts', `import type { LevelDefinition } from '../../core/types';\n\nexport let CAMPAIGN_LEVELS: readonly LevelDefinition[] = [];\nexport function setCampaignLevels(levels: readonly LevelDefinition[]): void { CAMPAIGN_LEVELS = levels; }\n`);

const levelMetrics = allLevels.map((level) => {
  const solved = replay(level, level.witness);
  const peakBuffer = solved.ok ? Math.max(0, ...solved.steps.map((step) => step.state.buffer.length)) : null;
  const legalMoveCounts = solved.ok ? solved.steps.map((step) => getLegalActions(level, step.state).length) : [];
  return {
    levelId: level.levelId,
    displayNumber: level.displayNumber,
    template: level.tags.find((tag) => LAYOUT_TEMPLATE_IDS.has(tag)) ?? 'legacy',
    pieceCount: level.pieces.length,
    targetRows: level.targetRows.length,
    parSpins: level.parSpins,
    witnessSteps: level.witness.length,
    witnessSpins: level.witness.filter((action) => action.kind === 'spin').length,
    witnessPeakBuffer: peakBuffer,
    minLegalActionsAlongWitness: legalMoveCounts.length ? Math.min(...legalMoveCounts) : null,
    maxLegalActionsAlongWitness: legalMoveCounts.length ? Math.max(...legalMoveCounts) : null,
    fingerprint: levelFingerprint(level),
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  total: allLevels.length,
  target: 200,
  status: 'complete',
  generation: {
    templateCounts,
    uniqueFingerprints: fingerprints.size,
    rejectedDuplicate,
    totalAttempts,
    fallbackCount: 0,
    fixedSeedSample: seedSample,
  },
  levels: levelMetrics,
};
writeFileSync('docs/level-generation-report.json', JSON.stringify(report, null, 2));
console.log(`levels:generate — ${allLevels.length}/200 levels generated and validated.`);
