import { deserializeSave, serializeSave } from '../core/serialization';
import type { GameSession } from '../core/session';
import type { LevelDefinition, Mode, SaveEnvelope } from '../core/types';

export const APP_SAVE_KEY = 'shape-spin-save-v2';
export const LEGACY_SAVE_KEY = 'shape-spin-demo-v1';
export const BACKUP_SAVE_KEY = 'shape-spin-save-v2-backup';

export interface PlayerProgress {
  readonly schemaVersion: 1;
  completedLevelIds: string[];
  selectedLevelId: string;
  locale: 'en' | 'zh-CN';
  soundEnabled: boolean;
  reducedMotion: boolean;
  rewardLedger: Record<string, number>;
}

export interface BrowserSaveData {
  readonly schemaVersion: 2;
  progress: PlayerProgress;
  activeRun: SaveEnvelope | null;
}

export interface SaveStore {
  readonly persistent: boolean;
  load(): BrowserSaveData | null;
  save(data: BrowserSaveData): boolean;
  clear(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function defaultProgress(levelId: string): PlayerProgress {
  return {
    schemaVersion: 1,
    completedLevelIds: [],
    selectedLevelId: levelId,
    locale: 'zh-CN',
    soundEnabled: true,
    reducedMotion: false,
    rewardLedger: {},
  };
}

function validateProgress(value: unknown, fallbackLevelId: string): PlayerProgress {
  if (!isRecord(value)) return defaultProgress(fallbackLevelId);
  const completedLevelIds = Array.isArray(value.completedLevelIds)
    ? value.completedLevelIds.filter((entry): entry is string => typeof entry === 'string' && entry.length <= 100).slice(0, 500)
    : [];
  const selectedLevelId = typeof value.selectedLevelId === 'string' && value.selectedLevelId.length <= 100 ? value.selectedLevelId : fallbackLevelId;
  const locale = value.locale === 'en' ? 'en' : 'zh-CN';
  const soundEnabled = value.soundEnabled !== false;
  const reducedMotion = value.reducedMotion === true;
  const rewardLedger: Record<string, number> = {};
  if (isRecord(value.rewardLedger)) {
    for (const [key, amount] of Object.entries(value.rewardLedger)) {
      if (key.length <= 160 && typeof amount === 'number' && Number.isInteger(amount) && amount >= 0) rewardLedger[key] = amount;
    }
  }
  return { schemaVersion: 1, completedLevelIds: [...new Set(completedLevelIds)], selectedLevelId, locale, soundEnabled, reducedMotion, rewardLedger };
}

function parseCurrent(raw: string, fallbackLevelId: string): BrowserSaveData | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) return null;
    return {
      schemaVersion: 2,
      progress: validateProgress(parsed.progress, fallbackLevelId),
      activeRun: isRecord(parsed.activeRun) ? parsed.activeRun as unknown as SaveEnvelope : null,
    };
  } catch {
    return null;
  }
}

/** Converts only safe global legacy records; legacy in-progress state is retained as backup, not trusted. */
function migrateLegacy(raw: string, levelIds: readonly string[], fallbackLevelId: string): BrowserSaveData | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const completedIndexes = Array.isArray(parsed.completed) ? parsed.completed : [];
    const completedLevelIds = completedIndexes
      .filter((index): index is number => Number.isInteger(index) && index >= 0 && index < levelIds.length)
      .map((index) => levelIds[index])
      .filter((levelId): levelId is string => levelId !== undefined);
    const levelIndex = typeof parsed.level === 'number' && Number.isInteger(parsed.level) && parsed.level >= 0 && parsed.level < levelIds.length ? parsed.level : 0;
    const selectedLevelId = levelIds[levelIndex] ?? fallbackLevelId;
    const rewardLedger = Object.fromEntries([...new Set(completedLevelIds)].map((levelId) => [`campaign:first-clear:${levelId}`, 10]));
    return {
      schemaVersion: 2,
      progress: { schemaVersion: 1, completedLevelIds: [...new Set(completedLevelIds)], selectedLevelId, locale: 'en', soundEnabled: parsed.sound !== false, reducedMotion: false, rewardLedger },
      activeRun: null,
    };
  } catch {
    return null;
  }
}

export function createBrowserSaveStore(fallbackLevelId: string, levelIds: readonly string[]): SaveStore {
  const memory = new Map<string, string>();
  const available = (() => {
    try {
      const probe = '__shape_spin_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch { return false; }
  })();
  const get = (key: string): string | null => available ? localStorage.getItem(key) : memory.get(key) ?? null;
  const set = (key: string, value: string): void => { if (available) localStorage.setItem(key, value); else memory.set(key, value); };

  return {
    persistent: available,
    load(): BrowserSaveData | null {
      const raw = get(APP_SAVE_KEY);
      if (raw) {
        const current = parseCurrent(raw, fallbackLevelId);
        if (current) return current;
        try { set(BACKUP_SAVE_KEY, raw); } catch { /* memory fallback continues */ }
      }
      const legacy = get(LEGACY_SAVE_KEY);
      if (!legacy) return null;
      const migrated = migrateLegacy(legacy, levelIds, fallbackLevelId);
      if (!migrated) return null;
      try {
        set(`${LEGACY_SAVE_KEY}-backup`, legacy);
        set(APP_SAVE_KEY, JSON.stringify(migrated));
      } catch { /* migration remains usable in memory */ }
      return migrated;
    },
    save(data: BrowserSaveData): boolean {
      try {
        const serialized = JSON.stringify(data);
        const old = get(APP_SAVE_KEY);
        if (old) set(BACKUP_SAVE_KEY, old);
        set(APP_SAVE_KEY, serialized);
        return true;
      } catch { return false; }
    },
    clear(): void {
      try {
        if (available) localStorage.removeItem(APP_SAVE_KEY); else memory.delete(APP_SAVE_KEY);
      } catch { /* ignore unavailable storage */ }
    },
  };
}

export function serializeActiveRun(session: GameSession, mode: Mode, savedAtMs: number): SaveEnvelope {
  const envelope: SaveEnvelope = {
    schemaVersion: 2,
    ruleVersion: 2,
    savedAtMs,
    mode,
    levelId: session.levelId,
    state: session.state,
    history: session.history.slice(-12),
    audit: session.audit,
  };
  // Reuse core serializer for size and serializability checks.
  serializeSave(envelope);
  return envelope;
}

export function restoreActiveRun(envelope: SaveEnvelope, level: LevelDefinition): GameSession {
  return deserializeSave(JSON.stringify(envelope), level);
}
