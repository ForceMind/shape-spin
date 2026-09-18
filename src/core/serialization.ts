import { RULE_VERSION } from './types';
import { restoreSession, historyForSave } from './session';
import { validateState } from './validation';
import type { GameSession } from './session';
import type { LevelDefinition, Mode, RunAudit, SaveEnvelope } from './types';

export const SAVE_SCHEMA_VERSION = 2;
export const MAX_SAVE_BYTES = 512 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function validateAudit(value: unknown): asserts value is RunAudit {
  if (!isRecord(value)
    || typeof value.runId !== 'string' || value.runId.length === 0
    || typeof value.startedAtMs !== 'number' || !Number.isFinite(value.startedAtMs) || value.startedAtMs < 0
    || !isNonNegativeInteger(value.hintCount)
    || !isNonNegativeInteger(value.undoCount)
    || !isNonNegativeInteger(value.spinsUsed)) {
    throw new Error('Invalid run audit');
  }
}

export function createSaveEnvelope(session: GameSession, mode: Mode, savedAtMs: number): SaveEnvelope {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    savedAtMs,
    mode,
    levelId: session.levelId,
    state: session.state,
    history: historyForSave(session),
    audit: session.audit,
  };
}

export function serializeSave(envelope: SaveEnvelope): string {
  const serialized = JSON.stringify(envelope);
  if (utf8ByteLength(serialized) > MAX_SAVE_BYTES) throw new Error('Save exceeds size limit');
  return serialized;
}

export function deserializeSave(serialized: string, level: LevelDefinition): GameSession {
  if (utf8ByteLength(serialized) > MAX_SAVE_BYTES) throw new Error('Save exceeds size limit');
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('Save is not valid JSON');
  }
  if (!isRecord(parsed)) throw new Error('Save envelope must be an object');
  if (parsed.schemaVersion !== SAVE_SCHEMA_VERSION) throw new Error('Unsupported save schema');
  if (parsed.ruleVersion !== RULE_VERSION) throw new Error('Unsupported rule version');
  if (parsed.levelId !== level.levelId) throw new Error('Save belongs to another level');
  if (!['campaign', 'daily', 'practice', 'editor'].includes(String(parsed.mode))) throw new Error('Invalid save mode');
  if (typeof parsed.savedAtMs !== 'number' || !Number.isFinite(parsed.savedAtMs) || parsed.savedAtMs < 0) throw new Error('Invalid save timestamp');
  if (!Array.isArray(parsed.history)) throw new Error('Invalid save history');
  validateAudit(parsed.audit);
  const state = parsed.state as Parameters<typeof validateState>[1];
  const history = parsed.history as Parameters<typeof restoreSession>[3];
  validateState(level, state);
  return restoreSession(level, state, parsed.audit, history);
}
