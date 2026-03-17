import { RetroLcdAnsiParser } from "./ansi-parser";
import type { CursorMode } from "../types";
import type {
  RetroLcdCell,
  RetroLcdCellStyle,
  RetroLcdCursorState,
  RetroLcdScreenBufferOptions,
  RetroLcdScreenSnapshot,
  RetroLcdWriteOptions
} from "./types";

const clampDimension = (value: number) => Math.max(1, Math.floor(value) || 1);

const DEFAULT_CELL_STYLE: RetroLcdCellStyle = {
  intensity: "normal",
  inverse: false,
  conceal: false,
  blink: false
};

const cloneStyle = (style: RetroLcdCellStyle): RetroLcdCellStyle => ({ ...style });

const createCell = (character: string, style: RetroLcdCellStyle): RetroLcdCell => ({
  char: character,
  style: cloneStyle(style)
});

const createBlankLine = (cols: number, style: RetroLcdCellStyle = DEFAULT_CELL_STYLE) =>
  Array.from({ length: cols }, () => createCell(" ", style));

const trimLine = (line: RetroLcdCell[]) =>
  line
    .map((cell) => cell.char)
    .join("")
    .replace(/\s+$/u, "");

const cloneGrid = (grid: RetroLcdCell[][]) =>
  grid.map((line) => line.map((cell) => createCell(cell.char, cell.style)));

const defaultSavedCursor = () => ({
  row: 0,
  col: 0
});

export class RetroLcdScreenBuffer {
  readonly rows: number;
  readonly cols: number;
  readonly scrollbackLimit: number;
  readonly tabWidth: number;
  private readonly grid: RetroLcdCell[][];
  private readonly scrollbackLines: string[] = [];
  private readonly parser: RetroLcdAnsiParser;
  private cursorState: RetroLcdCursorState;
  private savedCursorState = defaultSavedCursor();
  private currentStyle: RetroLcdCellStyle = cloneStyle(DEFAULT_CELL_STYLE);

  constructor(options: RetroLcdScreenBufferOptions) {
    this.rows = clampDimension(options.rows);
    this.cols = clampDimension(options.cols);
    this.scrollbackLimit = Math.max(0, Math.floor(options.scrollback ?? 200));
    this.tabWidth = Math.max(1, Math.floor(options.tabWidth ?? 4));
    this.grid = Array.from({ length: this.rows }, () => createBlankLine(this.cols));
    this.cursorState = {
      row: 0,
      col: 0,
      visible: true,
      mode: options.cursorMode ?? "solid"
    };
    this.parser = new RetroLcdAnsiParser({
      printable: (character) => this.writePrintable(character),
      lineFeed: () => this.lineFeed(),
      carriageReturn: () => this.carriageReturn(),
      backspace: () => this.backspace(),
      tab: () => this.insertTab(),
      formFeed: () => this.clear(),
      bell: () => undefined,
      cursorUp: (count) => this.cursorUp(count),
      cursorDown: (count) => this.cursorDown(count),
      cursorForward: (count) => this.cursorForward(count),
      cursorBackward: (count) => this.cursorBackward(count),
      cursorPosition: (row, col) => this.cursorPosition(row, col),
      eraseInDisplay: (mode) => this.eraseInDisplay(mode),
      eraseInLine: (mode) => this.eraseInLine(mode),
      saveCursor: () => this.saveCursor(),
      restoreCursor: () => this.restoreCursor(),
      setGraphicRendition: (params) => this.setGraphicRendition(params)
    });
  }

  clear() {
    for (let row = 0; row < this.rows; row += 1) {
      this.grid[row] = createBlankLine(this.cols, this.currentStyle);
    }

    this.cursorState = {
      ...this.cursorState,
      row: 0,
      col: 0
    };
  }

  reset() {
    this.clear();
    this.scrollbackLines.length = 0;
    this.currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
    this.savedCursorState = defaultSavedCursor();
    this.cursorState = {
      row: 0,
      col: 0,
      visible: true,
      mode: "solid"
    };
    this.parser.reset();
  }

  write(data: string, options?: RetroLcdWriteOptions) {
    this.parser.feed(data);

    if (options?.appendNewline) {
      this.carriageReturn();
      this.lineFeed();
    }
  }

  writeln(line: string) {
    this.write(line);
    this.carriageReturn();
    this.lineFeed();
  }

  moveCursorTo(row: number, col: number) {
    this.cursorState.row = Math.min(this.rows - 1, Math.max(0, Math.floor(row)));
    this.cursorState.col = Math.min(this.cols - 1, Math.max(0, Math.floor(col)));
  }

  setCursorVisible(visible: boolean) {
    this.cursorState.visible = visible;
  }

  setCursorMode(mode: CursorMode) {
    this.cursorState.mode = mode;
  }

  getCursor() {
    return { ...this.cursorState };
  }

  getSnapshot(): RetroLcdScreenSnapshot {
    const cells = cloneGrid(this.grid);
    const rawLines = cells.map((line) => line.map((cell) => cell.char).join(""));

    return {
      rows: this.rows,
      cols: this.cols,
      rawLines,
      cells,
      lines: rawLines.map((line) => line.replace(/\s+$/u, "")),
      scrollback: [...this.scrollbackLines],
      cursor: this.getCursor()
    };
  }

  private writePrintable(character: string) {
    this.grid[this.cursorState.row][this.cursorState.col] = createCell(character, this.currentStyle);

    if (this.cursorState.col === this.cols - 1) {
      this.carriageReturn();
      this.lineFeed();
      return;
    }

    this.cursorState.col += 1;
  }

  private insertTab() {
    const spaces = this.tabWidth - (this.cursorState.col % this.tabWidth || 0);

    for (let index = 0; index < spaces; index += 1) {
      this.writePrintable(" ");
    }
  }

  private carriageReturn() {
    this.cursorState.col = 0;
  }

  private cursorUp(count: number) {
    this.cursorState.row = Math.max(0, this.cursorState.row - Math.max(1, count));
  }

  private cursorDown(count: number) {
    this.cursorState.row = Math.min(this.rows - 1, this.cursorState.row + Math.max(1, count));
  }

  private cursorForward(count: number) {
    this.cursorState.col = Math.min(this.cols - 1, this.cursorState.col + Math.max(1, count));
  }

  private cursorBackward(count: number) {
    this.cursorState.col = Math.max(0, this.cursorState.col - Math.max(1, count));
  }

  private cursorPosition(row: number, col: number) {
    this.moveCursorTo(Math.max(0, row - 1), Math.max(0, col - 1));
  }

  private lineFeed() {
    if (this.cursorState.row === this.rows - 1) {
      const shifted = this.grid.shift();

      if (shifted) {
        this.scrollbackLines.push(trimLine(shifted));

        if (this.scrollbackLines.length > this.scrollbackLimit) {
          this.scrollbackLines.splice(0, this.scrollbackLines.length - this.scrollbackLimit);
        }
      }

      this.grid.push(createBlankLine(this.cols, this.currentStyle));
      return;
    }

    this.cursorState.row += 1;
  }

  private backspace() {
    if (this.cursorState.col > 0) {
      this.cursorState.col -= 1;
      this.grid[this.cursorState.row][this.cursorState.col] = createCell(" ", this.currentStyle);
      return;
    }

    if (this.cursorState.row > 0) {
      this.cursorState.row -= 1;
      this.cursorState.col = this.cols - 1;
      this.grid[this.cursorState.row][this.cursorState.col] = createCell(" ", this.currentStyle);
    }
  }

  private eraseInLine(mode: number) {
    const row = this.cursorState.row;

    switch (mode) {
      case 1:
        for (let col = 0; col <= this.cursorState.col; col += 1) {
          this.grid[row][col] = createCell(" ", this.currentStyle);
        }
        return;
      case 2:
        this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        return;
      default:
        for (let col = this.cursorState.col; col < this.cols; col += 1) {
          this.grid[row][col] = createCell(" ", this.currentStyle);
        }
    }
  }

  private eraseInDisplay(mode: number) {
    switch (mode) {
      case 1:
        for (let row = 0; row < this.cursorState.row; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
        for (let col = 0; col <= this.cursorState.col; col += 1) {
          this.grid[this.cursorState.row][col] = createCell(" ", this.currentStyle);
        }
        return;
      case 2:
        for (let row = 0; row < this.rows; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
        return;
      case 3:
        this.eraseInDisplay(2);
        this.scrollbackLines.length = 0;
        return;
      default:
        for (let col = this.cursorState.col; col < this.cols; col += 1) {
          this.grid[this.cursorState.row][col] = createCell(" ", this.currentStyle);
        }
        for (let row = this.cursorState.row + 1; row < this.rows; row += 1) {
          this.grid[row] = createBlankLine(this.cols, this.currentStyle);
        }
    }
  }

  private saveCursor() {
    this.savedCursorState = {
      row: this.cursorState.row,
      col: this.cursorState.col
    };
  }

  private restoreCursor() {
    this.moveCursorTo(this.savedCursorState.row, this.savedCursorState.col);
  }

  private setGraphicRendition(params: number[]) {
    const values = params.length > 0 ? params : [0];

    for (const code of values) {
      switch (code) {
        case 0:
          this.currentStyle = cloneStyle(DEFAULT_CELL_STYLE);
          break;
        case 1:
          this.currentStyle.intensity = "bold";
          break;
        case 2:
          this.currentStyle.intensity = "faint";
          break;
        case 5:
          this.currentStyle.blink = true;
          break;
        case 7:
          this.currentStyle.inverse = true;
          break;
        case 8:
          this.currentStyle.conceal = true;
          break;
        case 22:
          this.currentStyle.intensity = "normal";
          break;
        case 25:
          this.currentStyle.blink = false;
          break;
        case 27:
          this.currentStyle.inverse = false;
          break;
        case 28:
          this.currentStyle.conceal = false;
          break;
        default:
          break;
      }
    }
  }
}
