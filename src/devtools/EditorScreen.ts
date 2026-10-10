import type { LevelDefinition } from '../core/types';
import { validateLevel } from '../core/validation';
import { chooseJsonFile, downloadJson } from '../services/fileTransferService';
import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from '../screens/Screen';

const TYPES = ['yellow-circle', 'pink-triangle', 'cyan-square', 'coral-star', 'red-circle', 'blue-circle', 'green-square', 'orange-hexagon', 'lilac-diamond'] as const;

export interface EditorScreenOptions {
  readonly modal: Modal;
  readonly initialLevel: LevelDefinition;
  readonly onPlay: (level: LevelDefinition) => void;
  readonly onStatus: (message: string) => void;
  readonly locale: () => 'en' | 'zh-CN';
}

/** Development-only visual level editor; never writes campaign progress. */
export class EditorScreen extends BaseScreen {
  public readonly id = 'editor';
  private level: LevelDefinition;
  private selectedType = TYPES[0];
  private cursor: { row: number; column: number } | null = null;

  public constructor(private readonly options: EditorScreenOptions) {
    super();
    this.level = structuredClone(options.initialLevel);
  }

  public mount(): void { this.render(); }
  public unmount(): void { this.options.modal.close(); }

  public async handle(action: string, element: HTMLElement): Promise<boolean> {
    if (!action.startsWith('editor-')) return false;
    if (action === 'editor-type') this.selectedType = (element.dataset.type as typeof this.selectedType | undefined) ?? TYPES[0];
    else if (action === 'editor-cell') this.cycleCell(Number(element.dataset.row), Number(element.dataset.col));
    else if (action === 'editor-add-row') this.addRow();
    else if (action === 'editor-remove-row') this.removeRow();
    else if (action === 'editor-play') {
      const input = document.getElementById('editor-spins');
      const spins = input instanceof HTMLInputElement ? Number(input.value) : this.level.initialSpins;
      this.level = balanceTargets({ ...this.level, initialSpins: spins });
      validateLevel(this.level);
      this.options.modal.close();
      this.options.onPlay(this.level);
      return true;
    } else if (action === 'editor-export') downloadJson('shape-spin-level.json', this.level);
    else if (action === 'editor-import') {
      try {
        const value = await chooseJsonFile();
        validateLevel(value as LevelDefinition);
        this.level = value as LevelDefinition;
      } catch {
        this.options.onStatus(this.options.locale() === 'zh-CN' ? '关卡文件无效' : 'Invalid level file');
      }
    }
    this.render();
    return true;
  }

  private render(): void {
    const buttons = TYPES.map((typeId) => `<button class="editor-type${typeId === this.selectedType ? ' selected' : ''}" data-action="editor-type" data-type="${typeId}">${typeId}</button>`).join('');
    this.options.modal.open(`
      <button class="modal-close" data-action="close" aria-label="Close">×</button>
      <div class="modal-eyebrow">${t('editor.title')}</div>
      <h2 id="modal-title">${t('editor.title')}</h2>
      <p class="modal-description">${t('editor.description')}</p>
      <div class="editor-types">${buttons}</div>
      <div class="editor-grid" id="editor-grid">${this.gridHtml()}</div>
      <div class="modal-rule"><span class="rule-index">SPIN</span><div><strong>${t('game.spin')}</strong><input type="number" id="editor-spins" value="${this.level.initialSpins}" min="0" max="10" style="width:60px"></div></div>
      <button class="secondary-button" data-action="editor-add-row">${t('editor.addRow')}</button>
      <button class="secondary-button" data-action="editor-remove-row">${t('editor.removeRow')}</button>
      <button class="primary-button" data-action="editor-play">${t('editor.play')}</button>
      <button class="secondary-button" data-action="editor-export">${t('editor.export')}</button>
      <button class="secondary-button" data-action="editor-import">${t('editor.import')}</button>
    `);
  }

  private gridHtml(): string {
    const rows = Math.max(...this.level.cells.map((cell) => cell.row)) + 1;
    const columns = Math.max(...this.level.cells.map((cell) => cell.column)) + 1;
    let html = `<div class="editor-board" style="display:grid;grid-template-columns:repeat(${columns},40px);gap:4px;">`;
    for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
      const valid = this.level.cells.some((cell) => cell.row === row && cell.column === column);
      if (!valid) { html += '<div style="width:40px;height:40px;"></div>'; continue; }
      const piece = this.level.pieces.find((entry) => entry.row === row && entry.column === column);
      const cursor = this.cursor?.row === row && this.cursor.column === column ? ' cursor' : '';
      html += `<button class="editor-cell${cursor}" data-action="editor-cell" data-row="${row}" data-col="${column}" style="width:40px;height:40px;border:1px solid #ccc;background:${piece ? '#eee' : '#fff'};">${piece?.typeId.slice(0, 2) ?? '+'}</button>`;
    }
    return `${html}</div>`;
  }

  private cycleCell(row: number, column: number): void {
    this.cursor = { row, column };
    const index = this.level.pieces.findIndex((piece) => piece.row === row && piece.column === column);
    const pieces = [...this.level.pieces];
    if (index < 0) pieces.push({ pieceId: `editor-piece-${Date.now()}-${row}-${column}`, row, column, typeId: this.selectedType });
    else {
      const current = pieces[index];
      if (!current) return;
      const next = TYPES[(TYPES.indexOf(current.typeId as typeof TYPES[number]) + 1) % TYPES.length] ?? TYPES[0];
      pieces[index] = { ...current, typeId: next };
    }
    this.level = { ...this.level, pieces };
  }

  private addRow(): void {
    const row = Math.max(...this.level.cells.map((cell) => cell.row)) + 1;
    const columns = Math.max(...this.level.cells.map((cell) => cell.column)) + 1;
    const cells = [...this.level.cells];
    const pieces = [...this.level.pieces];
    for (let column = 0; column < columns; column += 1) {
      cells.push({ row, column });
      pieces.push({ pieceId: `editor-piece-${pieces.length}`, row, column, typeId: TYPES[0] });
    }
    this.level = { ...this.level, cells, pieces };
  }

  private removeRow(): void {
    const maxRow = Math.max(...this.level.cells.map((cell) => cell.row));
    if (maxRow <= 0) return;
    this.level = { ...this.level, cells: this.level.cells.filter((cell) => cell.row < maxRow), pieces: this.level.pieces.filter((piece) => piece.row < maxRow) };
  }
}

function balanceTargets(level: LevelDefinition): LevelDefinition {
  const slots = level.pieces.map((piece) => piece.typeId);
  const targetRows = [];
  for (let index = 0; index < slots.length; index += 3) targetRows.push({ rowId: `editor-target-${index / 3}`, slots: slots.slice(index, index + 3) });
  return { ...level, targetRows };
}
