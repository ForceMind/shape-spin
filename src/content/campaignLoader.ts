import type { LevelDefinition } from '../core/types';
import { validateLevel } from '../core/validation';

export interface CampaignLoadOptions {
  readonly basePath: string;
  readonly embedded?: unknown;
  readonly fetcher?: typeof fetch;
}

/** Always uses the current release's content; never trusts an old localStorage pack. */
export async function loadCampaignPack({ basePath, embedded, fetcher = fetch }: CampaignLoadOptions): Promise<readonly LevelDefinition[]> {
  let source: unknown = embedded;
  if (source === undefined) {
    const response = await fetcher(`${basePath}campaign.json`);
    if (!response.ok) throw new Error(`Campaign request failed: ${response.status}`);
    source = await response.json() as unknown;
  }
  if (!Array.isArray(source) || source.length !== 200) throw new Error('Campaign pack must contain exactly 200 levels');
  const levels = source as LevelDefinition[];
  levels.forEach(validateLevel);
  return levels;
}
