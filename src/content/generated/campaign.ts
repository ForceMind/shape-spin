import type { LevelDefinition } from '../../core/types';

// Populated by main.ts or the standalone builder; empty here so the runtime
// decides whether to read from storage, inline bundle, or fetch.
export let CAMPAIGN_LEVELS: readonly LevelDefinition[] = [];

export function setCampaignLevels(levels: readonly LevelDefinition[]): void {
  CAMPAIGN_LEVELS = levels;
}
