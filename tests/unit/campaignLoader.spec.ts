import { describe, expect, it, vi } from 'vitest';
import data from '../../src/content/generated/campaign.json';
import { loadCampaignPack } from '../../src/content/campaignLoader';

describe('loadCampaignPack', () => {
  it('loads the release pack from a subdirectory instead of a stale browser cache', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => data }));
    const levels = await loadCampaignPack({ basePath: '/shape-spin/', fetcher: fetcher as unknown as typeof fetch });
    expect(fetcher).toHaveBeenCalledWith('/shape-spin/campaign.json');
    expect(levels).toHaveLength(200);
  });

  it('uses the standalone embedded pack without a network request', async () => {
    const fetcher = vi.fn();
    const levels = await loadCampaignPack({ basePath: '/', embedded: data, fetcher: fetcher as unknown as typeof fetch });
    expect(levels).toHaveLength(200);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects missing and truncated packs instead of silently substituting old levels', async () => {
    await expect(loadCampaignPack({ basePath: '/', embedded: [] })).rejects.toThrow('200 levels');
    const fetcher = vi.fn(async () => ({ ok: false, status: 404 }));
    await expect(loadCampaignPack({ basePath: '/', fetcher: fetcher as unknown as typeof fetch })).rejects.toThrow('404');
  });
});
