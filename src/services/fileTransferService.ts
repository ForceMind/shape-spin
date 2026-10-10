import { deserializeSave } from '../core/serialization';
import type { LevelDefinition } from '../core/types';
import type { BrowserSaveData } from './saveService';

export function downloadJson(filename: string, value: unknown): void {
  const json = JSON.stringify(value, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function chooseJsonFile(maxBytes = 512 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      if (file.size > maxBytes) { reject(new Error('File exceeds size limit')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => {
        try { resolve(JSON.parse(String(reader.result)) as unknown); }
        catch { reject(new Error('Invalid JSON')); }
      };
      reader.readAsText(file);
    }, { once: true });
    input.click();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate before touching the existing store; never trust a TypeScript assertion on JSON. */
export function parseBrowserSaveData(value: unknown, levels: readonly LevelDefinition[]): BrowserSaveData {
  if (!isRecord(value) || value.schemaVersion !== 2) throw new Error('Unsupported save schema');
  const progress = value.progress;
  if (!isRecord(progress) || progress.schemaVersion !== 1
    || !Array.isArray(progress.completedLevelIds)
    || progress.completedLevelIds.length > 500
    || !progress.completedLevelIds.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 100)
    || typeof progress.selectedLevelId !== 'string' || !levels.some((level) => level.levelId === progress.selectedLevelId)
    || (progress.locale !== 'en' && progress.locale !== 'zh-CN')
    || typeof progress.soundEnabled !== 'boolean' || typeof progress.reducedMotion !== 'boolean'
    || !isRecord(progress.rewardLedger)
    || !Object.entries(progress.rewardLedger).every(([key, amount]) => key.length <= 160 && typeof amount === 'number' && Number.isInteger(amount) && amount >= 0)) {
    throw new Error('Invalid progress data');
  }
  let activeRun: BrowserSaveData['activeRun'] = null;
  if (value.activeRun !== null && value.activeRun !== undefined) {
    if (!isRecord(value.activeRun)) throw new Error('Invalid active run');
    if (value.activeRun.mode === 'campaign') {
      const level = levels.find((entry) => entry.levelId === (value.activeRun as Record<string, unknown>).levelId);
      if (!level) throw new Error('Active run belongs to another level');
      deserializeSave(JSON.stringify(value.activeRun), level);
      activeRun = value.activeRun as unknown as BrowserSaveData['activeRun'];
    } else if (!['daily', 'practice', 'editor'].includes(String(value.activeRun.mode))) {
      throw new Error('Invalid active run mode');
    }
  }
  const rewardLedger: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const [key, amount] of Object.entries(progress.rewardLedger)) {
    if (typeof amount !== 'number') throw new Error('Invalid reward amount');
    rewardLedger[key] = amount;
  }
  return {
    schemaVersion: 2,
    progress: {
      schemaVersion: 1,
      completedLevelIds: [...progress.completedLevelIds],
      selectedLevelId: progress.selectedLevelId,
      locale: progress.locale,
      soundEnabled: progress.soundEnabled,
      reducedMotion: progress.reducedMotion,
      rewardLedger,
    },
    activeRun,
  };
}
