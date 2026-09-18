let CAMPAIGN_LEVELS: readonly LevelDefinition[] = [];
let levelsLoaded = false;
async function loadLevels(): Promise<readonly LevelDefinition[]> {
  if (levelsLoaded) return CAMPAIGN_LEVELS;
  const response = await fetch('campaign.json');
  CAMPAIGN_LEVELS = await response.json();
  levelsLoaded = true;
  return CAMPAIGN_LEVELS;
}
import { PIECE_TYPES } from './content/pieceTypes';
import { createSession, dispatch, undo } from './core/session';
import { getLegalActions } from './core/engine';
import { getSelectablePieceIds } from './core/connectivity';
import { validateLevel } from './core/validation';
import type { GameSession } from './core/session';
import type { LevelDefinition } from './core/types';
import { setLocale, t } from './services/i18n';
import { playSound, setMuted, stopAudio, unlockAudio } from './services/audio';
import { createBrowserSaveStore, defaultProgress, restoreActiveRun, serializeActiveRun } from './services/saveService';
import type { Locale } from './core/types';

const SAVE_KEY = 'shape-spin-save-v2';
const $ = (id: string) => document.getElementById(id) as HTMLElement;
let LEVEL_IDS: string[] = [];
let saveStore: ReturnType<typeof createBrowserSaveStore>;

interface AppState {
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
  mode: 'campaign' | 'daily' | 'practice' | 'editor';
  dailyDate: string;
  practiceSeed: number;
  practiceDifficulty: number;
  editorLevel: LevelDefinition | null;
  editorSelectedType: string;
  editorCursor: { row: number; column: number } | null;
  rewardLedger: Record<string, number>;
}

const app: AppState = {
  session: null,
  levelIndex: 0,
  level: null,
  completed: [],
  locale: 'en',
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
  editorSelectedType: 'yellow-circle',
  editorCursor: null,
  rewardLedger: {},
};

function persist(): void {
  const level = app.level;
  const session = app.session;
  const selectedLevelId = level?.levelId ?? LEVEL_IDS[0] ?? 'campaign-001';
  const progress = defaultProgress(selectedLevelId);
  progress.completedLevelIds = app.completed
    .map((index) => CAMPAIGN_LEVELS[index]?.levelId)
    .filter((levelId): levelId is string => levelId !== undefined);
  progress.selectedLevelId = selectedLevelId;
  progress.locale = app.locale;
  progress.soundEnabled = app.soundEnabled;
  progress.reducedMotion = app.reducedMotion;
  progress.rewardLedger = { ...app.rewardLedger };
  const activeRun = level && session && session.state.phase === 'playing'
    ? serializeActiveRun(session, 'campaign', Date.now())
    : null;
  saveStore.save({ schemaVersion: 2, progress, activeRun });
}

function loadPersisted(): void {
  const stored = saveStore.load();
  if (!stored) return;
  const byId = new Map(CAMPAIGN_LEVELS.map((level, index) => [level.levelId, index]));
  app.completed = stored.progress.completedLevelIds
    .map((levelId) => byId.get(levelId))
    .filter((index): index is number => index !== undefined);
  app.levelIndex = byId.get(stored.progress.selectedLevelId) ?? 0;
  app.locale = stored.progress.locale;
  app.soundEnabled = stored.progress.soundEnabled;
  app.reducedMotion = stored.progress.reducedMotion;
  app.rewardLedger = { ...stored.progress.rewardLedger };
}

function getDailyLevel(): LevelDefinition {
  const now = new Date();
  const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const seed = Math.floor(utc / 86400000);
  const index = seed % CAMPAIGN_LEVELS.length;
  const level = CAMPAIGN_LEVELS[index];
  if (!level) throw new Error('Daily level index out of range');
  return { ...level, levelId: `daily-${utc}`, displayNumber: 0, titleKey: 'daily.title' };
}

function getPracticeLevel(seed: number, difficulty: number): LevelDefinition {
  const base = CAMPAIGN_LEVELS[(seed * 7 + difficulty * 13) % CAMPAIGN_LEVELS.length];
  if (!base) throw new Error('Practice level index out of range');
  return { ...base, levelId: `practice-${seed}-${difficulty}`, displayNumber: 0, titleKey: 'practice.title' };
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
    level = getDailyLevel();
    app.dailyDate = new Date().toISOString().slice(0, 10);
  } else if (app.mode === 'practice') {
    level = getPracticeLevel(app.practiceSeed, app.practiceDifficulty);
  } else if (app.mode === 'editor') {
    level = getEditorLevel();
  } else {
    const campaignLevel = CAMPAIGN_LEVELS[index];
    if (!campaignLevel) return;
    level = campaignLevel;
  }
  validateLevel(level);
  app.levelIndex = index;
  app.level = level;
  app.runStartMs = Date.now();
  const stored = allowStoredRun ? saveStore.load() : null;
  if (stored?.activeRun?.levelId === level.levelId) {
    try { app.session = restoreActiveRun(stored.activeRun, level); }
    catch { app.session = createSession(level, `run-${Date.now()}`, Date.now()); }
  } else {
    app.session = createSession(level, `run-${Date.now()}`, Date.now());
  }
  renderGame();
}

function handlePick(pieceId: string): void {
  if (!app.session || !app.level || app.busy) return;
  unlockAudio();
  const result = dispatch(app.session, app.level, { kind: 'pick', pieceId });
  if (!result.ok) {
    playSound('error');
    showStatus(result.reason === 'blocked' ? t('game.blocked') : result.reason === 'full' ? t('game.bufferFull') : t('game.firstMove'));
    return;
  }
  playEvents(result.events);
  startAnim(result.events);
  if (result.state.phase === 'won') {
    const isFirstClear = !app.completed.includes(app.levelIndex);
    if (isFirstClear) {
      app.completed.push(app.levelIndex);
      const levelId = CAMPAIGN_LEVELS[app.levelIndex]?.levelId;
      if (levelId) app.rewardLedger[`campaign:first-clear:${levelId}`] = 10;
    }
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
  if (!app.session || !app.level || app.busy) return;
  unlockAudio();
  const result = dispatch(app.session, app.level, { kind: 'spin' });
  if (!result.ok) {
    playSound('error');
    showStatus(result.reason === 'no-spins' ? t('game.spinEmpty') : t('game.spinLastRow'));
    return;
  }
  playEvents(result.events);
  startAnim(result.events);
  if (result.state.phase === 'won') {
    const isFirstClear = !app.completed.includes(app.levelIndex);
    if (isFirstClear) {
      app.completed.push(app.levelIndex);
      const levelId = CAMPAIGN_LEVELS[app.levelIndex]?.levelId;
      if (levelId) app.rewardLedger[`campaign:first-clear:${levelId}`] = 10;
    }
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
  if (!app.session || !app.level) return;
  unlockAudio();
  if (undo(app.session, app.level)) playSound('undo');
  renderGame();
}

function handleRestart(): void {
  startLevel(app.levelIndex, false);
  persist();
}

function showStatus(message: string): void {
  $('status').textContent = message;
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
  const session = app.session;
  const level = app.level;
  if (!session || !level) return;
  const state = session.state;
  const selectable = new Set(getSelectablePieceIds(level, state));

  $('level-number').textContent = String(app.levelIndex + 1).padStart(2, '0');
  $('level-title').textContent = t(level.titleKey);
  const fitCount = state.targets.reduce((n, row) => n + row.filled.filter(Boolean).length, 0);
  $('fit-count').textContent = `${fitCount} / ${level.pieces.length}`;
  ($('fit-progress') as HTMLElement).style.width = `${fitCount / level.pieces.length * 100}%`;
  $('buffer-count').textContent = `${state.buffer.length} / 5`;
  $('spin-count').textContent = `${state.spinsRemaining}`;
  const canSpin = getLegalActions(level, state).some((action) => action.kind === 'spin');
  ($('spin-button') as HTMLButtonElement).disabled = !canSpin;
  ($('undo-button') as HTMLButtonElement).disabled = session.history.length === 0;
  $('remaining-count').textContent = `${state.board.filter((p) => !p.removed).length} ${t('game.remaining')}`;

  if (state.phase === 'won') showStatus(t('game.won'));
  else if (state.phase === 'lost') showStatus(t('game.lost'));
  else if (state.buffer.length >= 4) showStatus(t('game.bufferFull'));
  else showStatus(t('game.firstMove'));

  const boardEl = $('piece-buttons');
  boardEl.innerHTML = '';
  const geo = computeBoardGeometry(level);
  for (const piece of state.board) {
    if (piece.removed) continue;
    const button = document.createElement('button');
    const { x, y, w, h } = cellRect(piece.row, piece.column, geo);
    button.className = 'piece-hit';
    button.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%;`;
    button.dataset.id = piece.pieceId;
    // Keep blocked pieces clickable so the player receives the required shake/status
    // feedback path; only an ended game disables board input entirely.
    button.disabled = state.phase !== 'playing';
    button.setAttribute('aria-disabled', String(!selectable.has(piece.pieceId) || state.phase !== 'playing'));
    button.setAttribute('aria-label', `${piece.typeId}: ${selectable.has(piece.pieceId) ? 'pickable' : 'blocked'}`);
    button.addEventListener('click', () => handlePick(piece.pieceId));
    boardEl.appendChild(button);
  }
  drawCanvas(level, state, geo, selectable);
}

interface BoardGeo { rows: number; cols: number; cell: number; left: number; top: number; }
function computeBoardGeometry(level: LevelDefinition): BoardGeo {
  const rows = Math.max(...level.cells.map((c) => c.row)) + 1;
  const cols = Math.max(...level.cells.map((c) => c.column)) + 1;
  const cell = Math.min(60, 240 / rows, 330 / cols);
  return { rows, cols, cell, left: (430 - cols * cell) / 2, top: 624 + (240 - rows * cell) / 2 };
}
function cellRect(row: number, col: number, geo: BoardGeo): { x: number; y: number; w: number; h: number } {
  return {
    x: (geo.left + col * geo.cell) / 430 * 100,
    y: (geo.top + row * geo.cell) / 900 * 100,
    w: geo.cell / 430 * 100,
    h: geo.cell / 900 * 100,
  };
}

function openModal(html: string): void {
  const modal = $('modal');
  const card = $('modal-card');
  card.innerHTML = html;
  modal.hidden = false;
  app.modalOpen = true;
  const interfaceLayer = document.querySelector('.interface');
  if (interfaceLayer instanceof HTMLElement) { interfaceLayer.setAttribute('inert', ''); interfaceLayer.style.pointerEvents = 'none'; }
  card.focus({ preventScroll: true });
}

function closeModal(): void {
  const modal = $('modal');
  modal.hidden = true;
  app.modalOpen = false;
  const interfaceLayer = document.querySelector('.interface');
  if (interfaceLayer instanceof HTMLElement) { interfaceLayer.removeAttribute('inert'); interfaceLayer.style.pointerEvents = ''; }
}

function computeStars(session: import('./core/session').GameSession, level: LevelDefinition): number {
  const audit = session.audit;
  const spinsUsed = audit.spinsUsed;
  if (audit.undoCount === 0 && audit.hintCount === 0 && spinsUsed <= level.parSpins) return 3;
  if (audit.undoCount <= 2 && audit.hintCount <= 1) return 2;
  return 1;
}

function showResult(won: boolean, isFirstClear = false): void {
  if (!app.session || !app.level) return;
  const session = app.session;
  const level = app.level;
  const elapsed = Math.max(0, Date.now() - app.runStartMs);
  const seconds = Math.floor(elapsed / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const stars = won ? computeStars(session, level) : 0;
  const starIcons = [1, 2, 3].map((i) => `<span class="star${i <= stars ? ' earned' : ''}">★</span>`).join('');
  const reward = won && isFirstClear ? 10 : 0;
  const rewardLine = reward > 0 ? `<p class="modal-description">${t('result.reward')}: +${reward}</p>` : '';
  openModal(`
    <div class="modal-eyebrow">${won ? t('game.won') : t('game.lost')}</div>
    <h2 id="modal-title">${t(level.titleKey)}</h2>
    <div class="star-row">${starIcons}</div>
    <div class="modal-rule"><span class="rule-index">◔</span><div><strong>${t('result.time')}</strong>${timeStr}</div></div>
    <div class="modal-rule"><span class="rule-index">↺</span><div><strong>${t('game.undo')}</strong>${session.audit.undoCount}</div></div>
    <div class="modal-rule"><span class="rule-index">⟳</span><div><strong>SPIN</strong>${session.audit.spinsUsed}</div></div>
    ${rewardLine}
    ${won && app.levelIndex + 1 < CAMPAIGN_LEVELS.length ? `<button class="primary-button" data-action="next-level">${t('result.next')}</button>` : ''}
    <button class="secondary-button" data-action="retry">${t('result.retry')}</button>
    <button class="secondary-button" data-action="show-levels">${t('result.back')}</button>
  `);
}

function showHelp(): void {
  openModal(`
    <button class="modal-close" data-action="close" aria-label="Close">×</button>
    <div class="modal-eyebrow">${t('help.title')}</div>
    <h2 id="modal-title">${t('app.tagline')}</h2>
    <div class="modal-rule"><span class="rule-index">01</span><div><strong>${t('help.rule1.title')}</strong>${t('help.rule1.body')}</div></div>
    <div class="modal-rule"><span class="rule-index">02</span><div><strong>${t('help.rule2.title')}</strong>${t('help.rule2.body')}</div></div>
    <div class="modal-rule"><span class="rule-index">03</span><div><strong>${t('help.rule3.title')}</strong>${t('help.rule3.body')}</div></div>
    <div class="modal-rule"><span class="rule-index">04</span><div><strong>${t('help.rule4.title')}</strong>${t('help.rule4.body')}</div></div>
    <button class="secondary-button" data-action="lang">${app.locale === 'zh-CN' ? 'Switch to English' : '切换为中文'}</button>
    <button class="primary-button" data-action="close">${t('menu.continue')}</button>
  `);
}

function showLevels(): void {
  const cards = CAMPAIGN_LEVELS.map((level, index) => {
    const current = index === app.levelIndex ? ' active' : '';
    const done = app.completed.includes(index) ? '<span class="done">✓</span>' : '';
    return `<button class="level-card${current}" data-action="level" data-level="${index}"><span class="num">${String(index + 1).padStart(2, '0')}</span><span class="name">${t(level.titleKey)}</span><span class="small">${level.pieces.length} · ${level.initialSpins} SPIN</span>${done}</button>`;
  }).join('');
  openModal(`
    <button class="modal-close" data-action="close" aria-label="Close">×</button>
    <div class="modal-eyebrow">${t('levels.title')}</div>
    <h2 id="modal-title">${t('menu.campaign')}</h2>
    <p class="modal-description">${app.completed.length} / ${CAMPAIGN_LEVELS.length}</p>
    <div class="level-grid">${cards}</div>
    <button class="secondary-button" data-action="close">${t('menu.continue')}</button>
  `);
}

function showSettings(): void {
  openModal(`
    <button class="modal-close" data-action="close" aria-label="Close">×</button>
    <div class="modal-eyebrow">${t('settings.title')}</div>
    <h2 id="modal-title">${t('app.title')}</h2>
    <div class="modal-rule"><span class="rule-index">◈</span><div><strong>${t('settings.language')}</strong><span id="settings-lang-label">${app.locale === 'zh-CN' ? '简体中文' : 'English'}</span></div></div>
    <button class="secondary-button" data-action="toggle-lang">${app.locale === 'zh-CN' ? 'Switch to English' : '切换为中文'}</button>
    <div class="modal-rule"><span class="rule-index">♪</span><div><strong>${t('settings.sound')}</strong><span id="settings-sound-label">${app.soundEnabled ? (app.locale === 'zh-CN' ? '开' : 'On') : (app.locale === 'zh-CN' ? '关' : 'Off')}</span></div></div>
    <button class="secondary-button" data-action="toggle-sound">${app.soundEnabled ? (app.locale === 'zh-CN' ? '关闭音效' : 'Mute') : (app.locale === 'zh-CN' ? '开启音效' : 'Unmute')}</button>
    <div class="modal-rule"><span class="rule-index">◉</span><div><strong>${t('settings.reducedMotion')}</strong><span id="settings-motion-label">${app.reducedMotion ? (app.locale === 'zh-CN' ? '开' : 'On') : (app.locale === 'zh-CN' ? '关' : 'Off')}</span></div></div>
    <button class="secondary-button" data-action="toggle-motion">${app.reducedMotion ? (app.locale === 'zh-CN' ? '关闭减少动效' : 'Disable reduced motion') : (app.locale === 'zh-CN' ? '开启减少动效' : 'Enable reduced motion')}</button>
    <hr style="border:none;border-top:1px solid #ccc;margin:12px 0">
    <button class="secondary-button" data-action="export-save">${t('settings.export')}</button>
    <button class="secondary-button" data-action="import-save">${t('settings.import')}</button>
    <button class="primary-button" data-action="close">${t('menu.continue')}</button>
  `);
}

function showEditor(): void {
  const types = ['yellow-circle','pink-triangle','cyan-square','coral-star','red-circle','blue-circle','green-square','orange-hexagon','lilac-diamond'];
  const typeButtons = types.map((typeId) => {
    const selected = typeId === app.editorSelectedType ? ' selected' : '';
    return `<button class="editor-type${selected}" data-action="editor-type" data-type="${typeId}">${typeId}</button>`;
  }).join('');
  openModal(`
    <button class="modal-close" data-action="close" aria-label="Close">×</button>
    <div class="modal-eyebrow">${t('editor.title')}</div>
    <h2 id="modal-title">${t('editor.title')}</h2>
    <p class="modal-description">${t('editor.description')}</p>
    <div class="editor-types">${typeButtons}</div>
    <div class="editor-grid" id="editor-grid"></div>
    <div class="modal-rule"><span class="rule-index">SPIN</span><div><strong>${t('game.spin')}</strong><input type="number" id="editor-spins" value="${app.editorLevel?.initialSpins ?? 3}" min="0" max="10" style="width:60px"></div></div>
    <button class="secondary-button" data-action="editor-add-row">${t('editor.addRow')}</button>
    <button class="secondary-button" data-action="editor-remove-row">${t('editor.removeRow')}</button>
    <button class="primary-button" data-action="editor-play">${t('editor.play')}</button>
    <button class="secondary-button" data-action="editor-export">${t('editor.export')}</button>
    <button class="secondary-button" data-action="editor-import">${t('editor.import')}</button>
  `);
  renderEditorGrid();
}

function renderEditorGrid(): void {
  const grid = document.getElementById('editor-grid');
  if (!grid || !app.editorLevel) return;
  const rows = Math.max(...app.editorLevel.cells.map(c => c.row)) + 1;
  const cols = Math.max(...app.editorLevel.cells.map(c => c.column)) + 1;
  let html = '<div class="editor-board" style="display:grid;grid-template-columns:repeat(' + cols + ',40px);gap:4px;">';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = app.editorLevel.pieces.find(p => p.row === r && p.column === c);
      const hasCell = app.editorLevel.cells.some(cell => cell.row === r && cell.column === c);
      const cursor = app.editorCursor?.row === r && app.editorCursor?.column === c ? ' cursor' : '';
      if (hasCell) {
        const typeId = piece?.typeId ?? '';
        html += `<button class="editor-cell${cursor}" data-action="editor-cell" data-row="${r}" data-col="${c}" style="width:40px;height:40px;border:1px solid #ccc;background:${typeId ? '#eee' : '#fff'};">${typeId ? typeId.slice(0, 2) : '+'}</button>`;
      } else {
        html += `<div style="width:40px;height:40px;"></div>`;
      }
    }
  }
  html += '</div>';
  grid.innerHTML = html;
}

function showPracticeSettings(): void {
  openModal(`
    <button class="modal-close" data-action="close" aria-label="Close">×</button>
    <div class="modal-eyebrow">${t('practice.title')}</div>
    <h2 id="modal-title">${t('practice.title')}</h2>
    <div class="modal-rule"><span class="rule-index">#</span><div><strong>${t('practice.seed')}</strong><input type="number" id="practice-seed" value="${app.practiceSeed}" min="1" max="999999" style="width:100px"></div></div>
    <div class="modal-rule"><span class="rule-index">★</span><div><strong>${t('practice.difficulty')}</strong><input type="range" id="practice-difficulty" min="1" max="10" value="${app.practiceDifficulty}" style="width:120px"></div></div>
    <button class="primary-button" data-action="practice-start">${t('menu.continue')}</button>
    <button class="secondary-button" data-action="close">${t('menu.settings')}</button>
  `);
}

function exportSave(): void {
  const stored = saveStore.load();
  if (!stored) { showStatus(app.locale === 'zh-CN' ? '暂无可导出的存档' : 'No save data to export'); return; }
  const json = JSON.stringify(stored, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shape-spin-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSave(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid save file');
        const data = parsed as Record<string, unknown>;
        if (data.schemaVersion !== 2) throw new Error('Unsupported schema version');
        saveStore.save(data as unknown as import('./services/saveService').BrowserSaveData);
        loadPersisted();
        setLocale(app.locale);
        document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
        setMuted(!app.soundEnabled);
        $('sound-button').classList.toggle('muted', !app.soundEnabled);
        $('sound-button').setAttribute('aria-pressed', String(app.soundEnabled));
        startLevel(app.levelIndex);
        closeModal();
        showStatus(app.locale === 'zh-CN' ? '存档导入成功' : 'Save imported successfully');
      } catch {
        showStatus(app.locale === 'zh-CN' ? '存档文件无效' : 'Invalid save file');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

function bindModalEvents(): void {
  $('modal-card').addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close') closeModal();
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
    if (action.dataset.action === 'next-level') {
      closeModal();
      if (app.levelIndex + 1 < CAMPAIGN_LEVELS.length) startLevel(app.levelIndex + 1, false);
      persist();
      return;
    }
    if (action.dataset.action === 'retry') { closeModal(); startLevel(app.levelIndex, false); persist(); return; }
    if (action.dataset.action === 'show-levels') { closeModal(); showLevels(); return; }
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
    if (action.dataset.action === 'editor-type') {
      app.editorSelectedType = action.dataset.type ?? 'yellow-circle';
      showEditor();
      return;
    }
    if (action.dataset.action === 'editor-cell') {
      const row = Number(action.dataset.row);
      const col = Number(action.dataset.col);
      app.editorCursor = { row, column: col };
      if (app.editorLevel) {
        const pieceIndex = app.editorLevel.pieces.findIndex(p => p.row === row && p.column === col);
        if (pieceIndex >= 0) {
          // Cycle through types on click
          const types = ['yellow-circle','pink-triangle','cyan-square','coral-star','red-circle','blue-circle','green-square','orange-hexagon','lilac-diamond'];
          const piece = app.editorLevel.pieces[pieceIndex];
          if (!piece) return;
          const current = piece.typeId;
          const next = types[(types.indexOf(current) + 1) % types.length] as string;
          const pieces = [...app.editorLevel.pieces];
          pieces[pieceIndex] = { ...piece, typeId: next };
          app.editorLevel = { ...app.editorLevel, pieces };
        }
      }
      renderEditorGrid();
      return;
    }
    if (action.dataset.action === 'editor-add-row') {
      if (app.editorLevel) {
        const maxRow = Math.max(...app.editorLevel.cells.map(c => c.row));
        const cols = Math.max(...app.editorLevel.cells.map(c => c.column)) + 1;
        const newCells = [...app.editorLevel.cells];
        const newPieces = [...app.editorLevel.pieces];
        for (let c = 0; c < cols; c++) {
          newCells.push({ row: maxRow + 1, column: c });
          newPieces.push({ row: maxRow + 1, column: c, pieceId: `editor-piece-${newPieces.length}`, typeId: 'yellow-circle' });
        }
        app.editorLevel = { ...app.editorLevel, cells: newCells, pieces: newPieces };
      }
      showEditor();
      return;
    }
    if (action.dataset.action === 'editor-remove-row') {
      if (app.editorLevel && app.editorLevel.cells.length > 4) {
        const maxRow = Math.max(...app.editorLevel.cells.map(c => c.row));
        app.editorLevel = {
          ...app.editorLevel,
          cells: app.editorLevel.cells.filter(c => c.row < maxRow),
          pieces: app.editorLevel.pieces.filter(p => p.row < maxRow),
        };
      }
      showEditor();
      return;
    }
    if (action.dataset.action === 'editor-play') {
      if (app.editorLevel) {
        const spinsInput = document.getElementById('editor-spins') as HTMLInputElement;
        const spins = spinsInput ? Number(spinsInput.value) : 3;
        // Auto-balance targets to match piece supply
        const supply = new Map<string, number>();
        for (const piece of app.editorLevel.pieces) supply.set(piece.typeId, (supply.get(piece.typeId) ?? 0) + 1);
        const targetRows: { rowId: string; slots: string[] }[] = [];
        let rowIndex = 0;
        for (const [typeId, count] of supply) {
          for (let i = 0; i < count; i++) {
            const lastRow = targetRows[targetRows.length - 1];
            if (!lastRow || lastRow.slots.length >= 3) {
              targetRows.push({ rowId: `editor-target-${rowIndex}`, slots: [typeId] });
              rowIndex += 1;
            } else {
              lastRow.slots.push(typeId);
            }
          }
        }
        app.editorLevel = { ...app.editorLevel, initialSpins: spins, targetRows };
        app.level = app.editorLevel;
        app.session = createSession(app.editorLevel, `editor-${Date.now()}`, Date.now());
        closeModal();
        renderGame();
      }
      return;
    }
    if (action.dataset.action === 'editor-export') {
      if (app.editorLevel) {
        const json = JSON.stringify(app.editorLevel, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shape-spin-level.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
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
    if (action.dataset.action === 'editor-import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result)) as LevelDefinition;
            validateLevel(parsed);
            app.editorLevel = parsed;
            showEditor();
          } catch {
            showStatus(app.locale === 'zh-CN' ? '关卡文件无效' : 'Invalid level file');
          }
        };
        reader.readAsText(file);
      });
      input.click();
      return;
    }
    if (action.dataset.action === 'level') {
      const index = Number(action.dataset.level);
      if (Number.isInteger(index) && index >= 0 && index < CAMPAIGN_LEVELS.length) {
        closeModal();
        startLevel(index, false);
        persist();
      }
    }
  });
  $('modal').addEventListener('click', (event) => { if (event.target === $('modal')) closeModal(); });
}

const DESIGN_W = 430; const DESIGN_H = 900;

function resizeCanvas(canvas: HTMLCanvasElement): void {
  const shell = document.getElementById('game');
  if (!shell) return;
  const rect = shell.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}

function drawCanvas(level: LevelDefinition, state: import('./core/types').GameState, geo: BoardGeo, selectable: ReadonlySet<string>): void {
  const canvas = $('scene') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width === 0 || canvas.height === 0) resizeCanvas(canvas);
  ctx.setTransform(canvas.width / DESIGN_W, 0, 0, canvas.height / DESIGN_H, 0, 0);
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

  const gradient = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
  gradient.addColorStop(0, '#f0f5eb'); gradient.addColorStop(0.5, '#e9f2e7'); gradient.addColorStop(1, '#dceedd');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

  drawReels(ctx, level, state);
  drawBufferArea(ctx, state);
  drawBoard(ctx, level, state, geo, selectable);
  drawAnimOverlays(ctx, geo);
}

const COLUMNS_X = [123, 215, 307] as const;
const REEL_CY = 293;
const BUFFER_X = [44, 103, 162, 221, 280] as const;
const BUFFER_Y = 523;

/* ---- Event animation stream (visual only; never mutates game state) ---- */

interface AnimState {
  active: boolean;
  startMs: number;
  durationMs: number;
  events: readonly import('./core/types').GameEvent[];
}

let anim: AnimState | null = null;
let rafId = 0;

function reducedMotion(): boolean {
  return app.reducedMotion === true || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function startAnim(events: readonly import('./core/types').GameEvent[]): void {
  if (reducedMotion() || events.length === 0) return;
  cancelAnimationFrame(rafId);
  anim = { active: true, startMs: performance.now(), durationMs: 420, events };
  tickAnim();
}

function tickAnim(): void {
  if (!anim) return;
  const elapsed = performance.now() - anim.startMs;
  const progress = Math.min(1, elapsed / anim.durationMs);
  renderGame();
  if (progress >= 1) { anim = null; return; }
  rafId = requestAnimationFrame(tickAnim);
}

function drawAnimOverlays(ctx: CanvasRenderingContext2D, geo: BoardGeo): void {
  if (!anim) return;
  const elapsed = performance.now() - anim.startMs;
  const p = Math.min(1, elapsed / anim.durationMs);
  const ease = 1 - Math.pow(1 - p, 3);
  const fade = 1 - ease;
  for (const ev of anim.events) {
    if (ev.type === 'rotated' && ev.reason === 'spin') {
      // Vertical sweep highlight on the reel column during spin.
      ctx.save();
      ctx.globalAlpha = 0.18 * fade;
      ctx.fillStyle = '#f4c64b';
      const sweepH = 60;
      const top = 183 + ease * (210 - sweepH);
      ctx.beginPath(); ctx.roundRect(54, top, 322, sweepH, 12); ctx.fill();
      ctx.restore();
    } else if (ev.type === 'stored') {
      // Rising glow on the buffer slot that received the piece.
      const x = BUFFER_X[ev.bufferIndex] ?? 44;
      ctx.save();
      ctx.globalAlpha = 0.35 * fade;
      ctx.fillStyle = '#479ddc';
      ctx.beginPath(); ctx.arc(x, BUFFER_Y - 5 - ease * 24, 20 - ease * 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (ev.type === 'fitted') {
      // Flash on the target slot that was filled, using the same visual layout
      // as drawReels (previous/current/next centered at REEL_CY ± 92).
      const currentActive = app.session?.state.activeTargetIndex ?? 0;
      const relRow = ev.rowIndex - currentActive;
      const visualOffset = relRow === 0 ? 0 : relRow > 0 ? 92 : -92;
      const cx = COLUMNS_X[Math.min(ev.slotIndex, COLUMNS_X.length - 1)] ?? 215;
      const cy = REEL_CY + visualOffset;
      ctx.save();
      ctx.globalAlpha = 0.4 * fade;
      ctx.strokeStyle = '#9cc956';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, 14 + ease * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawReels(ctx: CanvasRenderingContext2D, level: LevelDefinition, state: import('./core/types').GameState): void {
  // Soft pseudo-3D backdrop
  const backing = ctx.createLinearGradient(0, 188, 0, 405);
  backing.addColorStop(0, '#fcfcf2'); backing.addColorStop(0.55, '#dae6d7'); backing.addColorStop(1, '#a1baa8');
  ctx.beginPath(); ctx.roundRect(54, 183, 322, 210, 17); ctx.fillStyle = backing; ctx.fill();

  const total = level.targetRows.length;
  const active = state.activeTargetIndex;
  // Draw previous / current / next rows; only current row receives pieces.
  const rowsToShow = [active - 1, active, active + 1];
  const rowHeights = [46, 88, 46] as const;
  const rowCenters = [REEL_CY - 92, REEL_CY, REEL_CY + 92] as const;
  rowsToShow.forEach((rowIndex, slotIndex) => {
    const wrapped = ((rowIndex % total) + total) % total;
    const rowDef = level.targetRows[wrapped];
    const rowState = state.targets[wrapped];
    if (!rowDef || !rowState) return;
    const h = rowHeights[slotIndex] ?? 46;
    const cy = rowCenters[slotIndex] ?? REEL_CY;
    const isActive = slotIndex === 1;
    const alpha = isActive ? 1 : 0.45;
    rowDef.slots.forEach((typeId, colIndex) => {
      const x = COLUMNS_X[colIndex] ?? 215;
      const type = Object.values(PIECE_TYPES).find((entry) => entry.typeId === typeId);
      ctx.save();
      ctx.globalAlpha = alpha;
      // Slot tile
      const tileW = 88;
      const g = ctx.createLinearGradient(x - 44, cy - h / 2, x + 40, cy + h / 2);
      const colors = COLOR_MAP[type?.colorId ?? 'yellow'] ?? ['#ccc', '#eee', '#999'];
      g.addColorStop(0, colors[1]); g.addColorStop(1, colors[0]);
      ctx.beginPath(); ctx.roundRect(x - 44, cy - h / 2, tileW, h, 8); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = colors[2]; ctx.lineWidth = 1; ctx.stroke();
      // Hole or filled face
      const filled = rowState.filled[colIndex];
      if (filled) {
        drawToken(ctx, x, cy, isActive ? 17 : 12, type?.shapeId ?? 'circle', type?.colorId ?? 'yellow', true);
      } else {
        drawHole(ctx, x, cy, isActive ? 17 : 12, type?.shapeId ?? 'circle', type?.colorId ?? 'yellow');
      }
      ctx.restore();
    });
  });

  // Current-row white frame
  ctx.save();
  ctx.shadowColor = '#56735a20'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.beginPath(); ctx.roundRect(74, REEL_CY - 44, 282, 88, 13); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(70, REEL_CY - 48, 290, 96, 16); ctx.strokeStyle = '#adc5ae65'; ctx.lineWidth = 1.3; ctx.stroke();
}

function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, shape: string, colorId: string): void {
  const colors = COLOR_MAP[colorId] ?? ['#ccc', '#eee', '#999'];
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(0, 0, r, 0, Math.PI * 2);
  else if (shape === 'square') ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.25);
  else if (shape === 'triangle') { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r, r * 0.9); ctx.lineTo(-r, r * 0.9); ctx.closePath(); }
  else if (shape === 'diamond') { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, 0); ctx.lineTo(0, r * 1.1); ctx.lineTo(-r * 1.05, 0); ctx.closePath(); }
  else if (shape === 'hexagon') { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
  else { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 ? 0.5 : 1.1; i === 0 ? ctx.moveTo(Math.cos(a) * rad * r, Math.sin(a) * rad * r) : ctx.lineTo(Math.cos(a) * rad * r, Math.sin(a) * rad * r); } ctx.closePath(); }
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, colors[2]); g.addColorStop(1, colors[0]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = colors[2]; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function drawBufferArea(ctx: CanvasRenderingContext2D, state: import('./core/types').GameState): void {
  const danger = state.buffer.length >= 4;
  BUFFER_X.forEach((x, index) => {
    ctx.save();
    ctx.shadowColor = '#5a805731'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.roundRect(x - 24, BUFFER_Y - 22, 48, 48, 11); ctx.fillStyle = '#99b79d'; ctx.fill();
    ctx.restore();
    const g = ctx.createLinearGradient(0, BUFFER_Y - 25, 0, BUFFER_Y + 22);
    g.addColorStop(0, '#eff4e5'); g.addColorStop(1, '#d1dfc6');
    ctx.beginPath(); ctx.roundRect(x - 24, BUFFER_Y - 25, 48, 46, 11); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#f9fbef'; ctx.lineWidth = 1.2; ctx.stroke();
    if (index >= state.buffer.length) {
      ctx.strokeStyle = danger ? '#c89e7070' : '#a6bda638'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x - 20, BUFFER_Y - 21, 40, 38, 8); ctx.stroke();
    }
  });
  state.buffer.forEach((piece, index) => {
    const x = BUFFER_X[index] ?? 44;
    const type = Object.values(PIECE_TYPES).find((entry) => entry.typeId === piece.typeId);
    drawToken(ctx, x, BUFFER_Y - 5, 17, type?.shapeId ?? 'circle', type?.colorId ?? 'yellow', true);
  });
}

function drawBoard(ctx: CanvasRenderingContext2D, level: LevelDefinition, state: import('./core/types').GameState, geo: BoardGeo, selectable: ReadonlySet<string>): void {
  for (const piece of state.board) {
    const x = geo.left + piece.column * geo.cell;
    const y = geo.top + piece.row * geo.cell;
    ctx.fillStyle = piece.removed ? '#d2e2cd' : '#dce8d6';
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, geo.cell - 2, geo.cell - 2, 8); ctx.fill();
    if (piece.removed) continue;
    const type = Object.values(PIECE_TYPES).find((entry) => entry.typeId === piece.typeId);
    const isSelectable = selectable.has(piece.pieceId);
    drawToken(ctx, x + geo.cell / 2, y + geo.cell / 2, geo.cell * 0.34, type?.shapeId ?? 'circle', type?.colorId ?? 'yellow', isSelectable);
  }
}

const COLOR_MAP: Record<string, [string, string, string]> = {
  yellow: ['#f4c64b', '#ffe88c', '#ba7c23'], pink: ['#ec91b2', '#ffd2e1', '#b5507a'],
  cyan: ['#62cad3', '#b8eff0', '#277e93'], coral: ['#f57661', '#ffbba1', '#b23f39'],
  red: ['#ec7258', '#ffb394', '#b44333'], blue: ['#479ddc', '#a2d6f7', '#23679e'],
  green: ['#9cc956', '#deedac', '#587e35'], orange: ['#f3aa50', '#ffe0a4', '#b96d2e'],
  lilac: ['#9b97dc', '#d7cffb', '#625b9d'],
};

function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, shape: string, colorId: string, highlighted: boolean): void {
  const [color, light, dark] = COLOR_MAP[colorId] ?? ['#ccc', '#eee', '#999'];
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = highlighted ? 1 : 0.83;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  else if (shape === 'square') ctx.roundRect(-r * 0.84, -r * 0.84, r * 1.68, r * 1.68, r * 0.23);
  else if (shape === 'triangle') { ctx.moveTo(0, -r * 1.04); ctx.lineTo(r, r * 0.82); ctx.lineTo(-r, r * 0.82); ctx.closePath(); }
  else if (shape === 'diamond') { ctx.moveTo(0, -r * 1.05); ctx.lineTo(r * 1.02, 0); ctx.lineTo(0, r * 1.05); ctx.lineTo(-r * 1.02, 0); ctx.closePath(); }
  else if (shape === 'hexagon') { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
  else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 ? 0.48 : 1.05; i === 0 ? ctx.moveTo(Math.cos(a) * rad * r, Math.sin(a) * rad * r) : ctx.lineTo(Math.cos(a) * rad * r, Math.sin(a) * rad * r); } ctx.closePath(); }
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, light); g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = highlighted ? 2 : 1;
  ctx.stroke();
  ctx.restore();
}

async function init(): Promise<void> {
  await loadLevels();
  LEVEL_IDS = CAMPAIGN_LEVELS.map((level) => level.levelId);
  saveStore = createBrowserSaveStore(LEVEL_IDS[0] ?? 'campaign-001', LEVEL_IDS);
  loadPersisted();
  setLocale(app.locale);
  document.documentElement.lang = app.locale === 'zh-CN' ? 'zh-CN' : 'en';
  setMuted(!app.soundEnabled);
  $('sound-button').classList.toggle('muted', !app.soundEnabled);
  $('sound-button').setAttribute('aria-pressed', String(app.soundEnabled));
  startLevel(app.levelIndex);
  $('spin-button').addEventListener('click', handleSpin);
  $('undo-button').addEventListener('click', handleUndo);
  $('restart-button').addEventListener('click', handleRestart);
  $('help-button').addEventListener('click', showHelp);
  $('level-button').addEventListener('click', showLevels);
  $('settings-button').addEventListener('click', showSettings);
  $('daily-button').addEventListener('click', () => { unlockAudio(); app.mode = 'daily'; startLevel(0, false); });
  $('practice-button').addEventListener('click', () => { unlockAudio(); app.mode = 'practice'; showPracticeSettings(); });
  $('editor-button').addEventListener('click', () => { unlockAudio(); app.mode = 'editor'; app.editorLevel = getEditorLevel(); showEditor(); });
  $('sound-button').addEventListener('click', () => {
    app.soundEnabled = !app.soundEnabled;
    setMuted(!app.soundEnabled);
    if (app.soundEnabled) { unlockAudio(); playSound('fit'); }
    $('sound-button').classList.toggle('muted', !app.soundEnabled);
    $('sound-button').setAttribute('aria-pressed', String(app.soundEnabled));
    persist();
  });
  bindModalEvents();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAudio(); });
  window.addEventListener('resize', () => { const canvas = $('scene') as HTMLCanvasElement; resizeCanvas(canvas); renderGame(); });
  document.addEventListener('keydown', (e) => {
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
