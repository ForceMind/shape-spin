import type { LevelDefinition } from '../../core/types';

export let CAMPAIGN_LEVELS: readonly LevelDefinition[] = [];
export function setCampaignLevels(levels: readonly LevelDefinition[]): void { CAMPAIGN_LEVELS = levels; }
