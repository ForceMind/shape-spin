export type RewardMode = 'campaign' | 'daily' | 'practice' | 'editor';

export interface RewardResult {
  readonly firstClear: boolean;
  readonly key: string | null;
  readonly amount: number;
  readonly ledger: Record<string, number>;
}

/** Stable, idempotent client-side reward bookkeeping. */
export function recordFirstClearReward(
  ledger: Readonly<Record<string, number>>,
  mode: RewardMode,
  levelId: string,
  dailyDate: string,
): RewardResult {
  if (mode === 'practice' || mode === 'editor') return { firstClear: false, key: null, amount: 0, ledger: { ...ledger } };
  const key = mode === 'campaign' ? `campaign:first-clear:${levelId}` : `daily:first-clear:${dailyDate}`;
  if (ledger[key] !== undefined) return { firstClear: false, key, amount: 0, ledger: { ...ledger } };
  return { firstClear: true, key, amount: 10, ledger: { ...ledger, [key]: 10 } };
}

export function totalRewards(ledger: Readonly<Record<string, number>>): number {
  return Object.values(ledger).reduce((total, amount) => total + amount, 0);
}
