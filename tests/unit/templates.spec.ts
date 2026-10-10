import { describe, expect, it } from 'vitest';
import { LAYOUT_TEMPLATES, cellsFromMask, levelFingerprint, templateForCampaignLevel } from '../../src/levels/templates';
import type { LevelDefinition } from '../../src/core/types';

describe('layout templates', () => {
  it('contains at least ten structurally distinct valid masks', () => {
    expect(LAYOUT_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    const masks = new Set(LAYOUT_TEMPLATES.map((template) => template.mask.join('/')));
    expect(masks.size).toBe(LAYOUT_TEMPLATES.length);
    for (const template of LAYOUT_TEMPLATES) {
      expect(cellsFromMask(template.mask).length).toBeGreaterThan(0);
      expect(template.mask[0]?.includes('1')).toBe(true);
    }
  });

  it('keeps legacy 1–8 and starts deterministic template families at level 9', () => {
    expect(templateForCampaignLevel(8).id).toBe('rectangle');
    expect(templateForCampaignLevel(9).id).toBe('rectangle');
    expect(templateForCampaignLevel(10).id).toBe('stair');
    expect(templateForCampaignLevel(18).id).toBe('notched');
    expect(templateForCampaignLevel(19).id).toBe('rectangle');
  });

  it('fingerprint ignores type renaming but retains topology and resources', () => {
    const base: LevelDefinition = {
      levelId: 'a', contentVersion: 1, ruleVersion: 2, displayNumber: 21, chapter: 2, titleKey: 'x',
      cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
      pieces: [{ pieceId: 'a', row: 0, column: 0, typeId: 'yellow-circle' }, { pieceId: 'b', row: 0, column: 1, typeId: 'pink-triangle' }],
      targetRows: [{ rowId: 'r', slots: ['yellow-circle', 'pink-triangle'] }],
      initialSpins: 1, seed: 1, generatorVersion: 1, tags: [], parSpins: 0, witness: [],
    };
    const renamed = { ...base, levelId: 'b', pieces: [{ ...base.pieces[0]!, typeId: 'alpha' }, { ...base.pieces[1]!, typeId: 'beta' }], targetRows: [{ rowId: 'r', slots: ['alpha', 'beta'] }] };
    expect(levelFingerprint(renamed)).toBe(levelFingerprint(base));
    expect(levelFingerprint({ ...base, initialSpins: 2 })).not.toBe(levelFingerprint(base));
  });
});
