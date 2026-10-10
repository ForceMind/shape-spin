import { CAMPAIGN_LEVELS as campaignLevels, setCampaignLevels } from './content/generated/campaign';
import { loadCampaignPack } from './content/campaignLoader';

function getLevels(): readonly LevelDefinition[] { return campaignLevels; }

let levelsLoaded = false;

async function loadLevels(): Promise<readonly LevelDefinition[]> {
  if (levelsLoaded) return campaignLevels;
  const levels = await loadCampaignPack({
    basePath: import.meta.env.BASE_URL,
    embedded: (window as Window & { __SHAPE_SPIN_CAMPAIGN__?: unknown }).__SHAPE_SPIN_CAMPAIGN__,
  });
  setCampaignLevels(levels);
  levelsLoaded = true;
  return campaignLevels;
}
import { PIECE_TYPES } from './content/pieceTypes';
import { createSession } from './core/session';
import { validateLevel } from './core/validation';
import type { LevelDefinition } from './core/types';
import { setLocale, t } from './services/i18n';
import { playSound, setMuted, stopAudio, unlockAudio } from './services/audio';
import { ProgressService, createProgressService } from './services/progressService';
import { parseBrowserSaveData, chooseJsonFile, downloadJson } from './services/fileTransferService';
import { recordFirstClearReward } from './services/rewardService';
import { buildDailyLevel, utcDateKey } from './services/dailyService';
import { buildPracticeLevel, normalizePracticeRequest } from './services/practiceService';
import { CanvasRenderer } from './render/CanvasRenderer';
import { GameController } from './game/GameController';
import { Modal } from './ui/Modal';
import { ListenerBag } from './app/ListenerBag';
import { AppRouter } from './app/AppRouter';
import { HelpScreen } from './screens/HelpScreen';
import { CampaignScreen } from './screens/CampaignScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ResultScreen } from './screens/ResultScreen';
import { HomeScreen } from './screens/HomeScreen';
import { GameScreen } from './screens/GameScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { EditorScreen } from './devtools/EditorScreen';
import { createInitialAppState, type AppState } from './app/AppState';

const SAVE_KEY = 'shape-spin-save-v2';
const DEV_MODE = new URLSearchParams(window.location.search).get('dev') === '1';
const $ = (id: string) => document.getElementById(id) as HTMLElement;
let canvasRenderer: CanvasRenderer | null = null;
let gameController: GameController | null = null;
let modalController: Modal | null = null;
let gameScreen: GameScreen | null = null;
let editorScreen: EditorScreen | null = null;
const appListeners = new ListenerBag();
const appRouter = new AppRouter();

function reducedMotion(): boolean {
  return app.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
let LEVEL_IDS: string[] = [];
let progressService: ProgressService;

const app: AppState = createInitialAppState();

function persist(): void {
  if (!app.level || !app.session) return;
  progressService.setLocale(app.locale);
  progressService.setSoundEnabled(app.soundEnabled);
  progressService.setReducedMotion(app.reducedMotion);
  progressService.setRewardLedger(app.rewardLedger);
  for (const index of app.completed) {
    const levelId = getLevels()[index]?.levelId;
    if (levelId) progressService.markCompleted(levelId);
  }
  progressService.save(app.mode, app.level, app.session);
}

function loadPersisted(): void {
  const progress = progressService.snapshot();
  const byId = new Map(getLevels().map((level, index) => [level.levelId, index]));
  app.completed = progress.completedLevelIds
    .map((levelId) => byId.get(levelId))
    .filter((index): index is number => index !== undefined);
  app.levelIndex = byId.get(progress.selectedLevelId) ?? 0;
  app.locale = progress.locale;
  app.soundEnabled = progress.soundEnabled;
  app.reducedMotion = progress.reducedMotion;
  app.rewardLedger = { ...progress.rewardLedger };
}

function getEditorLevel(): LevelDefinition {
  if (app.editorLevel) return app.editorLevel;
  // Default 4x4 editor board with 3 target rows
  const cells = Array.from({ length: 16 }, (_, i) => ({ row: Math.floor(i / 4), column: i % 4 }));
  const pieces = cells.map((pos, i) => ({
    ...pos, pieceId: `editor-piece-${i}`, typeId: 'yellow-circle',
  }));
  return {
    levelId: 'editor-custom', contentVersion: 1, ruleVersion: 2,
    displayNumber: 0, chapter: 0, titleKey: 'editor.title',
    cells, pieces,
    targetRows: [
      { rowId: 'editor-target-0', slots: ['yellow-circle', 'pink-triangle', 'cyan-square'] },
      { rowId: 'editor-target-1', slots: ['coral-star', 'red-circle', 'blue-circle'] },
    ],
    initialSpins: 3, seed: 0, generatorVersion: 0,
    tags: ['editor'], parSpins: 0, witness: [],
  };
}

function startLevel(index: number, allowStoredRun = true): void {
  let level: LevelDefinition;
  if (app.mode === 'daily') {
    const now = new Date();
    level = buildDailyLevel(getLevels(), now);
    app.dailyDate = utcDateKey(now);
  } else if (app.mode === 'practice') {
    const request = normalizePracticeRequest(app.practiceSeed, app.practiceDifficulty);
    app.practiceSeed = request.seed;
    app.practiceDifficulty = request.difficulty;
    level = buildPracticeLevel(getLevels(), request);
  } else if (app.mode === 'editor') {
    level = getEditorLevel();
  } else {
    const campaignLevel = getLevels()[index];
    if (!campaignLevel) return;
    level = campaignLevel;
  }
  validateLevel(level);
  app.levelIndex = index;
  app.level = level;
  if (app.mode === 'campaign') progressService.selectLevel(level.levelId);
  app.runStartMs = Date.now();
  const restored = allowStoredRun ? progressService.restoreRun(level) : null;
  app.session = restored ?? createSession(level, `run-${Date.now()}`, Date.now());
  const canvas = $('scene') as HTMLCanvasElement;
  canvasRenderer ??= new CanvasRenderer(canvas);
  if (gameController) gameController.replace(level, app.session);
  else gameController = new GameController(canvasRenderer, level, app.session, reducedMotion);
  if (!gameScreen) {
    gameScreen = new GameScreen({
      controller: gameController,
      locale: () => app.locale,
      levelIndex: () => app.levelIndex,
      onPick: handlePick,
      onSpin: handleSpin,
      onUndo: handleUndo,
      onRestart: handleRestart,
      onHelp: showHelp,
      onCampaign: () => { void showLevels(); },
      onSettings: showSettings,
      soundEnabled: () => app.soundEnabled,
      onSoundToggle: handleSoundToggle,
    });
    gameScreen.mount();
  }
  renderGame();
  if (progressService.takeRecoveryNotice()) {
    showStatus(t('game.runRestarted'));
  }
}

function recordFirstClear(): boolean {
  if (!app.level) return false;
  const result = recordFirstClearReward(app.rewardLedger, app.mode, app.level.levelId, app.dailyDate);
  app.rewardLedger = result.ledger;
  if (result.firstClear && app.mode === 'campaign' && !app.completed.includes(app.levelIndex)) app.completed.push(app.levelIndex);
  return result.firstClear;
}

function handlePick(pieceId: string): void {
  if (!app.session || !app.level || !gameController || app.busy) return;
  unlockAudio();
  const result = gameController.pick(pieceId);
  if (!result.ok) {
    playSound('error');
    showStatus(result.reason === 'blocked' ? t('game.blocked') : result.reason === 'full' ? t('game.bufferFull') : t('game.firstMove'));
    return;
  }
  playEvents(result.events);
  if (result.state.phase === 'won') {
    const isFirstClear = recordFirstClear();
    persist();
    renderGame();
    showResult(true, isFirstClear);
    return;
  }
  persist();
  renderGame();
  if (result.state.phase === 'lost') showResult(false, false);
}

function handleSpin(): void {
  if (!app.session || !app.level || !gameController || app.busy) return;
  unlockAudio();
  const result = gameController.spin();
  if (!result.ok) {
    playSound('error');
    showStatus(result.reason === 'no-spins' ? t('game.spinEmpty') : t('game.spinLastRow'));
    return;
  }
  playEvents(result.events);
  if (result.state.phase === 'won') {
    const isFirstClear = recordFirstClear();
    persist();
    renderGame();
    showResult(true, isFirstClear);
    return;
  }
  persist();
  renderGame();
  if (result.state.phase === 'lost') showResult(false, false);
}

function handleUndo(): void {
  if (!app.session || !app.level || !gameController) return;
  unlockAudio();
  if (gameController.undo()) playSound('undo');
  renderGame();
}

function handleRestart(): void {
  startLevel(app.levelIndex, false);
  persist();
}

function handleSoundToggle(): void {
  app.soundEnabled = !app.soundEnabled;
  setMuted(!app.soundEnabled);
  if (app.soundEnabled) { unlockAudio(); playSound('fit'); }
  persist();
  gameScreen?.render();
}

function showStatus(message: string): void {
  $('status').textContent = message;
}

function openModal(html: string): void {
  modalController?.open(html);
  app.modalOpen = modalController?.isOpen ?? false;
}

function closeModal(): void {
  modalController?.close();
  app.modalOpen = false;
}


function showResult(won: boolean, isFirstClear = false): void {
  if (!app.session || !app.level || !modalController) return;
  appRouter.replace(new ResultScreen({
    modal: modalController,
    level: app.level,
    session: app.session,
    locale: app.locale,
    won,
    firstClear: isFirstClear,
    elapsedMs: Date.now() - app.runStartMs,
    canGoNext: app.mode === 'campaign' && app.levelIndex + 1 < getLevels().length,
  }));
  app.modalOpen = modalController.isOpen;
}

function showHome(): void {
  if (!modalController) return;
  appRouter.replace(new HomeScreen({ modal: modalController, hasSavedRun: progressService.hasActiveRun(app.level ?? undefined), devMode: DEV_MODE }));
  app.modalOpen = modalController.isOpen;
}

function showHelp(): void {
  if (!modalController) return;
  appRouter.replace(new HelpScreen({ modal: modalController, locale: () => app.locale }));
  app.modalOpen = modalController.isOpen;
}

async function showLevels(): Promise<void> {
  if (!levelsLoaded) await loadLevels();
  if (!modalController) return;
  appRouter.replace(new CampaignScreen({
    modal: modalController,
    levels: getLevels(),
    completedIndexes: new Set(app.completed),
    currentIndex: app.levelIndex,
    locale: app.locale,
  }));
  app.modalOpen = modalController.isOpen;
}

function showSettings(): void {
  if (!modalController) return;
  appRouter.replace(new SettingsScreen({
    modal: modalController,
    locale: app.locale,
    soundEnabled: app.soundEnabled,
    reducedMotion: app.reducedMotion,
  }));
  app.modalOpen = modalController.isOpen;
}

function openDevEditor(): void {
  if (!DEV_MODE || !modalController) return;
  const initial = app.editorLevel ?? getEditorLevel();
  editorScreen = new EditorScreen({
    modal: modalController,
    initialLevel: initial,
    locale: () => app.locale,
    onStatus: showStatus,
    onPlay: (level) => {
      app.mode = 'editor';
      app.editorLevel = level;
      app.level = level;
      app.session = createSession(level, `editor-${Date.now()}`, Date.now());
      if (gameController) gameController.replace(level, app.session);
      renderGame();
    },
  });
  appRouter.replace(editorScreen);
  app.modalOpen = modalController.isOpen;
}

function showPracticeSettings(): void {
  if (!modalController) return;
  appRouter.replace(new PracticeScreen({ modal: modalController, seed: app.practiceSeed, difficulty: app.practiceDifficulty }));
  app.modalOpen = modalController.isOpen;
}

function exportSave(): void {
  downloadJson(`shape-spin-save-${new Date().toISOString().slice(0, 10)}.json`, progressService.exportData());
}

async function importSave(): Promise<void> {
  try {
    const data = parseBrowserSaveData(await chooseJsonFile(), getLevels());
    progressService.import(data);
    loadPersisted();
    setLocale(app.locale);
    document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
    setMuted(!app.soundEnabled);
    startLevel(app.levelIndex);
    closeModal();
    showStatus(app.locale === 'zh-CN' ? '存档导入成功' : 'Save imported successfully');
  } catch {
    showStatus(app.locale === 'zh-CN' ? '存档文件无效' : 'Invalid save file');
  }
}

function bindModalEvents(): void {
  modalController?.setActionHandler((actionName, action) => {
    if (actionName === 'close') closeModal();
    if (action.dataset.action === 'home-start') {
      closeModal();
      app.mode = 'campaign';
      startLevel(app.levelIndex, true);
      return;
    }
    if (action.dataset.action === 'home-help') {
      showHelp();
      return;
    }
    if (action.dataset.action === 'editor-open') {
      openDevEditor();
      return;
    }
    if (action.dataset.action?.startsWith('editor-') && editorScreen) {
      void editorScreen.handle(action.dataset.action, action);
      return;
    }
    if (action.dataset.action === 'toggle-lang') {
      app.locale = app.locale === 'zh-CN' ? 'en' : 'zh-CN';
      setLocale(app.locale);
      document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
      persist();
      renderGame();
      showSettings();
      return;
    }
    if (action.dataset.action === 'toggle-sound') {
      app.soundEnabled = !app.soundEnabled;
      setMuted(!app.soundEnabled);
      if (app.soundEnabled) { unlockAudio(); playSound('fit'); }
      $('sound-button').classList.toggle('muted', !app.soundEnabled);
      $('sound-button').setAttribute('aria-pressed', String(app.soundEnabled));
      persist();
      showSettings();
      return;
    }
    if (action.dataset.action === 'toggle-motion') {
      app.reducedMotion = !app.reducedMotion;
      persist();
      showSettings();
      return;
    }
    if (action.dataset.action === 'daily-start') {
      closeModal();
      app.mode = 'daily';
      startLevel(0, false);
      return;
    }
    if (action.dataset.action === 'practice-open') {
      closeModal();
      app.mode = 'practice';
      showPracticeSettings();
      return;
    }
    if (action.dataset.action === 'next-level') {
      closeModal();
      if (app.levelIndex + 1 < getLevels().length) startLevel(app.levelIndex + 1, false);
      persist();
      return;
    }
    if (action.dataset.action === 'retry') { closeModal(); startLevel(app.levelIndex, false); persist(); return; }
    if (action.dataset.action === 'show-levels') { closeModal(); void showLevels(); return; }
    if (action.dataset.action === 'export-save') { exportSave(); return; }
    if (action.dataset.action === 'import-save') { importSave(); return; }
    if (action.dataset.action === 'lang') {
      app.locale = app.locale === 'zh-CN' ? 'en' : 'zh-CN';
      setLocale(app.locale);
      document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
      persist();
      renderGame();
      showHelp();
      return;
    }
    if (action.dataset.action === 'practice-start') {
      const seedInput = document.getElementById('practice-seed') as HTMLInputElement;
      const diffInput = document.getElementById('practice-difficulty') as HTMLInputElement;
      if (seedInput) app.practiceSeed = Math.max(1, Number(seedInput.value));
      if (diffInput) app.practiceDifficulty = Math.min(10, Math.max(1, Number(diffInput.value)));
      closeModal();
      startLevel(0, false);
      persist();
      return;
    }
    if (action.dataset.action === 'level') {
      const index = Number(action.dataset.level);
      if (Number.isInteger(index) && index >= 0 && index < getLevels().length) {
        closeModal();
        startLevel(index, false);
        persist();
      }
    }
  });
}


function playEvents(events: readonly import('./core/types').GameEvent[]): void {
  if (events.some((event) => event.type === 'picked')) playSound('pick');
  if (events.some((event) => event.type === 'stored')) playSound('store');
  if (events.some((event) => event.type === 'fitted')) playSound('fit');
  if (events.some((event) => event.type === 'rowCompleted')) playSound('complete');
  if (events.some((event) => event.type === 'rotated' && event.reason === 'spin')) playSound('spin');
  if (events.some((event) => event.type === 'won')) playSound('win');
  if (events.some((event) => event.type === 'lost')) playSound('error');
}

function renderGame(): void {
  gameScreen?.render();
}

// Canvas presentation is owned by src/render/CanvasRenderer.ts.
// Legacy static drawing helpers were intentionally removed during R1/R2;
// the original implementation remains immutable in reference/demo-baseline/.


async function init(): Promise<void> {
  await loadLevels();
  levelsLoaded = true;
  LEVEL_IDS = getLevels().map((level) => level.levelId);
  progressService = createProgressService(LEVEL_IDS[0] ?? 'campaign-001', LEVEL_IDS);
  loadPersisted();
  setLocale(app.locale);
  document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
  setMuted(!app.soundEnabled);
  $('sound-button').classList.toggle('muted', !app.soundEnabled);
  $('sound-button').setAttribute('aria-pressed', String(app.soundEnabled));
  startLevel(app.levelIndex);
  modalController = new Modal($('modal'), $('modal-card'), document.querySelector('.interface'));
  modalController.setCloseHandler(() => { app.modalOpen = false; });
  bindModalEvents();
  showHome();
  appListeners.listen(window, 'pagehide', () => {
    persist();
    canvasRenderer?.clear();
    gameScreen?.unmount();
    appRouter.destroy();
    modalController?.destroy();
    appListeners.clear();
  });
  appListeners.listen(document, 'visibilitychange', () => { if (document.hidden) stopAudio(); });
  appListeners.listen(window, 'resize', () => { canvasRenderer?.resize(); renderGame(); });
  appListeners.listen(document, 'keydown', (e) => {
    if (app.modalOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      return;
    }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleSpin(); }
    else if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); handleUndo(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); handleRestart(); }
    else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); showHelp(); }
  });
}

init();
