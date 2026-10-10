import { describe, expect, it } from 'vitest';
import { recordFirstClearReward, totalRewards } from '../../src/services/rewardService';

describe('rewardService', () => {
  it('awards campaign first clear exactly once by stable level identity', () => {
    const first = recordFirstClearReward({}, 'campaign', 'campaign-010', '');
    expect(first.firstClear).toBe(true);
    expect(first.amount).toBe(10);
    const replay = recordFirstClearReward(first.ledger, 'campaign', 'campaign-010', '');
    expect(replay.firstClear).toBe(false);
    expect(totalRewards(replay.ledger)).toBe(10);
  });

  it('awards daily first clear once per UTC identity and never rewards practice/editor', () => {
    const first = recordFirstClearReward({}, 'daily', 'daily-1', '2026-09-18');
    const sameDay = recordFirstClearReward(first.ledger, 'daily', 'daily-2', '2026-09-18');
    const nextDay = recordFirstClearReward(sameDay.ledger, 'daily', 'daily-3', '2026-09-19');
    expect(sameDay.firstClear).toBe(false);
    expect(nextDay.firstClear).toBe(true);
    expect(recordFirstClearReward(nextDay.ledger, 'practice', 'practice-1', '').firstClear).toBe(false);
    expect(recordFirstClearReward(nextDay.ledger, 'editor', 'editor-1', '').firstClear).toBe(false);
  });
});
