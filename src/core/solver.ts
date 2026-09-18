/**
 * BFS solver over the deterministic state space. Uses the production engine
 * for every transition — no duplicated rules. A level is 'solvable' only when
 * a witness is found; 'unknown' means the node cap was hit and is never
 * treated as unsolvable.
 */
import { applyAction, createGame, createRunAudit, getLegalActions } from './engine';
import type { GameState, LevelDefinition, PlayerAction } from './types';

/**
 * Follows a known pick order (legacyPlan) and inserts SPIN actions when the
 * active target row has no matching slot for the next piece. Returns a witness
 * or null if the plan cannot be replayed within the spin budget.
 */
export function seedWitness(level: LevelDefinition, pickOrder: readonly number[]): readonly PlayerAction[] | null {
  const state = createGame(level);
  let audit = createRunAudit('seed', 0);
  const actions: PlayerAction[] = [];
  let current = state;

  for (const pieceIndex of pickOrder) {
    const piece = current.board[pieceIndex];
    if (!piece || piece.removed) return null;
    // Try picking directly — engine will buffer if no active slot matches.
    const result = applyAction(level, current, audit, { kind: 'pick', pieceId: piece.pieceId });
    if (result.ok) {
      actions.push({ kind: 'pick', pieceId: piece.pieceId });
      current = result.state;
      audit = result.audit;
      continue;
    }
    // Pick failed (buffer full or blocked). Try spinning to a row that accepts
    // this piece, then pick again.
    if (result.reason !== 'full' && result.reason !== 'blocked') return null;
    const needed = level.targetRows.findIndex((r, i) => {
      if (i === current.activeTargetIndex || current.targets[i]?.completed) return false;
      return r.slots.some((typeId, j) => typeId === piece.typeId && current.targets[i]?.filled[j] === null);
    });
    if (needed < 0) return null;
    let spins = 0;
    while (current.activeTargetIndex !== needed && spins < level.initialSpins) {
      const spinResult = applyAction(level, current, audit, { kind: 'spin' });
      if (!spinResult.ok) return null;
      actions.push({ kind: 'spin' });
      current = spinResult.state;
      audit = spinResult.audit;
      spins += 1;
    }
    if (current.activeTargetIndex !== needed) return null;
    const retry = applyAction(level, current, audit, { kind: 'pick', pieceId: piece.pieceId });
    if (!retry.ok) return null;
    actions.push({ kind: 'pick', pieceId: piece.pieceId });
    current = retry.state;
    audit = retry.audit;
  }
  if (current.phase !== 'won') return null;
  return actions;
}

export type SolveResult =
  | { readonly outcome: 'solvable'; readonly witness: readonly PlayerAction[]; readonly spinsUsed: number; readonly nodes: number }
  | { readonly outcome: 'unsolvable'; readonly nodes: number }
  | { readonly outcome: 'unknown'; readonly nodes: number };

function stateKey(state: GameState): string {
  const board = state.board.map((p) => (p.removed ? '1' : '0')).join('');
  const buffer = state.buffer.map((b) => b.typeId).join(',');
  const targets = state.targets.map((t) => t.filled.map((f) => (f ? '1' : '0')).join('')).join('|');
  return `${state.phase}|${state.activeTargetIndex}|${state.spinsRemaining}|${board}|${buffer}|${targets}`;
}

/** BFS from the initial state; deterministic via sorted legal actions. */
export function solve(level: LevelDefinition, maxNodes = 200_000): SolveResult {
  const initial = createGame(level);
  const queue: { state: GameState; path: PlayerAction[] }[] = [{ state: initial, path: [] }];
  const visited = new Set<string>([stateKey(initial)]);
  let nodes = 0;

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    nodes += 1;
    if (nodes > maxNodes) return { outcome: 'unknown', nodes };

    if (node.state.phase === 'won') {
      const spinsUsed = node.path.filter((a) => a.kind === 'spin').length;
      return { outcome: 'solvable', witness: node.path, spinsUsed, nodes };
    }
    if (node.state.phase === 'lost') continue;

    // Prefer picks that fit the active target row (direct progress), then other
    // picks, then spin. This heuristic keeps BFS shallow enough for the legacy
    // levels while remaining complete (all actions are still explored).
    const actions = [...getLegalActions(level, node.state)].sort((a, b) => {
      if (a.kind === 'spin' && b.kind === 'spin') return 0;
      if (a.kind === 'spin') return 1;
      if (b.kind === 'spin') return -1;
      const aFit = fitsActive(level, node.state, a.pieceId) ? 0 : 1;
      const bFit = fitsActive(level, node.state, b.pieceId) ? 0 : 1;
      if (aFit !== bFit) return aFit - bFit;
      return a.pieceId.localeCompare(b.pieceId);
    });
    for (const action of actions) {
      const audit = createRunAudit('solve', 0);
      const result = applyAction(level, node.state, audit, action);
      if (!result.ok) continue;
      const key = stateKey(result.state);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ state: result.state, path: [...node.path, action] });
    }
  }
  return { outcome: 'unsolvable', nodes };
}

function fitsActive(level: LevelDefinition, state: GameState, pieceId: string): boolean {
  const piece = state.board.find((p) => p.pieceId === pieceId && !p.removed);
  if (!piece) return false;
  const row = level.targetRows[state.activeTargetIndex];
  const target = state.targets[state.activeTargetIndex];
  if (!row || !target) return false;
  return row.slots.some((typeId, i) => typeId === piece.typeId && target.filled[i] === null);
}
