import { applyAction, createGame, createRunAudit } from './engine';
import { validateState } from './validation';
import type { GameEvent, GameState, LevelDefinition, PlayerAction, RunAudit } from './types';

export interface ReplayStep {
  readonly action: PlayerAction;
  readonly state: GameState;
  readonly audit: RunAudit;
  readonly events: readonly GameEvent[];
}

export type ReplayResult =
  | { readonly ok: true; readonly state: GameState; readonly audit: RunAudit; readonly steps: readonly ReplayStep[] }
  | { readonly ok: false; readonly actionIndex: number; readonly reason: string; readonly state: GameState; readonly audit: RunAudit; readonly steps: readonly ReplayStep[] };

/** Replays actions through the production engine; no special witness rules exist. */
export function replay(level: LevelDefinition, actions: readonly PlayerAction[], runId = 'replay'): ReplayResult {
  let state = createGame(level);
  let audit = createRunAudit(runId, 0);
  const steps: ReplayStep[] = [];

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
    const action = actions[actionIndex];
    if (!action) continue;
    const result = applyAction(level, state, audit, action);
    if (!result.ok) return { ok: false, actionIndex, reason: result.reason, state, audit, steps };
    state = result.state;
    audit = result.audit;
    steps.push({ action, state, audit, events: result.events });
  }

  validateState(level, state);
  return { ok: true, state, audit, steps };
}
