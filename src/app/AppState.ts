import type { GameSession } from '../core/session';
import type { LevelDefinition, Locale } from '../core/types';

export type GameMode = 'campaign' | 'daily' | 'practice' | 'editor';

export interface AppState {
  session: GameSession | null;
  levelIndex: number;
  level: LevelDefinition | null;
  completed: number[];
  locale: Locale;
  soundEnabled: boolean;
  busy: boolean;
  modalOpen: boolean;
  reducedMotion: boolean;
  runStartMs: number;
  mode: GameMode;
  dailyDate: string;
  practiceSeed: number;
  practiceDifficulty: number;
  editorLevel: LevelDefinition | null;
  rewardLedger: Record<string, number>;
}

export function createInitialAppState(): AppState {
  return {
    session: null,
    levelIndex: 0,
    level: null,
    completed: [],
    locale: 'zh-CN',
    soundEnabled: true,
    busy: false,
    modalOpen: false,
    reducedMotion: false,
    runStartMs: 0,
    mode: 'campaign',
    dailyDate: '',
    practiceSeed: 42,
    practiceDifficulty: 3,
    editorLevel: null,
    rewardLedger: {},
  };
}
