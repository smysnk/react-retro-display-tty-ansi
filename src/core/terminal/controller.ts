import type { CursorMode, RetroLcdController } from "../types";
import { RetroLcdScreenBuffer } from "./screen-buffer";
import type {
  RetroLcdScreenBufferOptions,
  RetroLcdScreenSnapshot,
  RetroLcdWriteOptions
} from "./types";

type ControllerOperation =
  | { type: "write"; data: string; options?: RetroLcdWriteOptions }
  | { type: "writeln"; line: string }
  | { type: "clear" }
  | { type: "reset" }
  | { type: "moveCursorTo"; row: number; col: number }
  | { type: "setCursorVisible"; visible: boolean }
  | { type: "setCursorMode"; mode: CursorMode };

const clampDimension = (value: number, fallback: number) => {
  const nextValue = Math.floor(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallback;
};

class RetroLcdControllerStore implements RetroLcdController {
  private readonly listeners = new Set<() => void>();
  private readonly history: ControllerOperation[] = [];
  private readonly options: Pick<RetroLcdScreenBufferOptions, "scrollback" | "tabWidth">;
  private rows: number;
  private cols: number;
  private buffer: RetroLcdScreenBuffer;

  constructor(options: Partial<RetroLcdScreenBufferOptions> = {}) {
    this.rows = clampDimension(options.rows ?? 9, 9);
    this.cols = clampDimension(options.cols ?? 46, 46);
    this.options = {
      scrollback: options.scrollback,
      tabWidth: options.tabWidth
    };
    this.buffer = new RetroLcdScreenBuffer({
      rows: this.rows,
      cols: this.cols,
      scrollback: options.scrollback,
      tabWidth: options.tabWidth,
      cursorMode: options.cursorMode
    });

    if (options.cursorMode && options.cursorMode !== "solid") {
      this.history.push({
        type: "setCursorMode",
        mode: options.cursorMode
      });
    }
  }

  write(data: string, options?: RetroLcdWriteOptions) {
    this.buffer.write(data, options);
    this.history.push({
      type: "write",
      data,
      options
    });
    this.emit();
  }

  writeln(line: string) {
    this.buffer.writeln(line);
    this.history.push({
      type: "writeln",
      line
    });
    this.emit();
  }

  clear() {
    this.buffer.clear();
    this.history.push({ type: "clear" });
    this.emit();
  }

  reset() {
    this.buffer.reset();
    this.history.length = 0;
    this.history.push({ type: "reset" });
    this.emit();
  }

  moveCursorTo(row: number, col: number) {
    this.buffer.moveCursorTo(row, col);
    this.history.push({
      type: "moveCursorTo",
      row,
      col
    });
    this.emit();
  }

  resize(rows: number, cols: number) {
    const nextRows = clampDimension(rows, this.rows);
    const nextCols = clampDimension(cols, this.cols);

    if (nextRows === this.rows && nextCols === this.cols) {
      return;
    }

    this.rows = nextRows;
    this.cols = nextCols;
    this.buffer = new RetroLcdScreenBuffer({
      rows: this.rows,
      cols: this.cols,
      scrollback: this.options.scrollback,
      tabWidth: this.options.tabWidth
    });
    this.replay();
    this.emit();
  }

  setCursorVisible(visible: boolean) {
    this.buffer.setCursorVisible(visible);
    this.history.push({
      type: "setCursorVisible",
      visible
    });
    this.emit();
  }

  setCursorMode(mode: CursorMode) {
    this.buffer.setCursorMode(mode);
    this.history.push({
      type: "setCursorMode",
      mode
    });
    this.emit();
  }

  getSnapshot(): RetroLcdScreenSnapshot {
    return this.buffer.getSnapshot();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private replay() {
    for (const operation of this.history) {
      switch (operation.type) {
        case "write":
          this.buffer.write(operation.data, operation.options);
          break;
        case "writeln":
          this.buffer.writeln(operation.line);
          break;
        case "clear":
          this.buffer.clear();
          break;
        case "reset":
          this.buffer.reset();
          break;
        case "moveCursorTo":
          this.buffer.moveCursorTo(operation.row, operation.col);
          break;
        case "setCursorVisible":
          this.buffer.setCursorVisible(operation.visible);
          break;
        case "setCursorMode":
          this.buffer.setCursorMode(operation.mode);
          break;
      }
    }
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const createRetroLcdController = (
  options: Partial<RetroLcdScreenBufferOptions> = {}
): RetroLcdController => new RetroLcdControllerStore(options);
