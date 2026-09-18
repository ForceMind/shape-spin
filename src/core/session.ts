import { applyAction, createGame, createRunAudit } from './engine';
import { validateState } from './validation';
import type { ActionResult, GameState, LevelDefinition, PlayerAction, RunAudit } from './types';

export const MEMORY_HISTORY_LIMIT = 50;
export const SAVED_HISTORY_LIMIT = 12;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface GameSession {
  readonly levelId: string;
  state: GameState;
  audit: RunAudit;
  history: GameState[];
}

export function createSession(level: LevelDefinition, runId: string, startedAtMs: number): GameSession {
  return { levelId: level.levelId, state: createGame(level), audit: createRunAudit(runId, startedAtMs), history: [] };
}

export function restoreSession(level: LevelDefinition, state: GameState, audit: RunAudit, history: readonly GameState[]): GameSession {
  validateState(level, state);
  const safeHistory = history.slice(-MEMORY_HISTORY_LIMIT).map((entry) => {
    validateState(level, entry);
    return clone(entry);
  });
  return { levelId: level.levelId, state: clone(state), audit: clone(audit), history: safeHistory };
}

/** Commits one successful player action and one matching undo snapshot. */
export function dispatch(session: GameSession, level: LevelDefinition, action: PlayerAction): ActionResult {
  if (session.levelId !== level.levelId) throw new Error('Session level does not match definition');
  const before = clone(session.state);
  const result = applyAction(level, session.state, session.audit, action);
  if (!result.ok) return result;

  session.history.push(before);
  if (session.history.length > MEMORY_HISTORY_LIMIT) session.history.splice(0, session.history.length - MEMORY_HISTORY_LIMIT);
  session.state = result.state;
  session.audit = result.audit;
  return result;
}

/**
 * Undo restores one complete pre-action state, including automatic chains and
 * SPIN balance. Audit is intentionally not restored; only undoCount increases.
 */
export function undo(session: GameSession, level: LevelDefinition): boolean {
  if (session.levelId !== level.levelId) throw new Error('Session level does not match definition');
  const previous = session.history[session.history.length - 1];
  if (!previous) return false;
  // Validate before popping so a corrupt snapshot cannot silently consume history.
  validateState(level, previous);
  session.history.pop();
  session.state = clone(previous);
  session.audit.undoCount += 1;
  return true;
}

export function historyForSave(session: GameSession): readonly GameState[] {
  return session.history.slice(-SAVED_HISTORY_LIMIT).map(clone);
}
