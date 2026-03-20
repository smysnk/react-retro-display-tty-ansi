import type {
  CursorMode,
  RetroLcdController,
  RetroLcdWriteChunk
} from "../types";
import { RetroLcdScreenBuffer } from "./screen-buffer";
import type {
  RetroLcdScreenBufferOptions,
  RetroLcdScreenSnapshot,
  RetroLcdWriteOptions
} from "./types";

type ControllerOperation =
  | { type: "write"; data: string; options?: RetroLcdWriteOptions }
  | { type: "writeMany"; chunks: RetroLcdWriteChunk[] }
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

const normalizeWriteChunk = (
  chunk: RetroLcdWriteChunk
): {
  data: string;
  options?: RetroLcdWriteOptions;
} =>
  typeof chunk === "string"
    ? {
        data: chunk
      }
    : {
        data: chunk.data,
        options: chunk.options
      };

class RetroLcdControllerStore implements RetroLcdController {
  private readonly listeners = new Set<() => void>();
  private readonly history: ControllerOperation[] = [];
  private readonly options: Pick<RetroLcdScreenBufferOptions, "scrollback" | "tabWidth">;
  private rows: number;
  private cols: number;
  private buffer: RetroLcdScreenBuffer;
  private cachedSnapshot: RetroLcdScreenSnapshot | null = null;
  private notificationSuspendDepth = 0;
  private hasPendingNotification = false;

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
    this.markDirtyAndEmit();
  }

  writeMany(chunks: readonly RetroLcdWriteChunk[]) {
    if (chunks.length === 0) {
      return;
    }

    this.batch(() => {
      for (const chunk of chunks) {
        const normalized = normalizeWriteChunk(chunk);
        this.buffer.write(normalized.data, normalized.options);
      }

      this.history.push({
        type: "writeMany",
        chunks: chunks.map((chunk) =>
          typeof chunk === "string"
            ? chunk
            : {
                data: chunk.data,
                options: chunk.options
              }
        )
      });
      this.markDirtyAndEmit();
    });
  }

  writeln(line: string) {
    this.buffer.writeln(line);
    this.history.push({
      type: "writeln",
      line
    });
    this.markDirtyAndEmit();
  }

  clear() {
    this.buffer.clear();
    this.history.push({ type: "clear" });
    this.markDirtyAndEmit();
  }

  reset() {
    this.buffer.reset();
    this.history.length = 0;
    this.history.push({ type: "reset" });
    this.markDirtyAndEmit();
  }

  batch<T>(fn: () => T) {
    this.suspendNotifications();

    try {
      return fn();
    } finally {
      this.resumeNotifications();
    }
  }

  suspendNotifications() {
    this.notificationSuspendDepth += 1;
  }

  resumeNotifications() {
    if (this.notificationSuspendDepth === 0) {
      return;
    }

    this.notificationSuspendDepth -= 1;
    if (this.notificationSuspendDepth === 0 && this.hasPendingNotification) {
      this.hasPendingNotification = false;
      this.emitNow();
    }
  }

  moveCursorTo(row: number, col: number) {
    this.buffer.moveCursorTo(row, col);
    this.history.push({
      type: "moveCursorTo",
      row,
      col
    });
    this.markDirtyAndEmit();
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
    this.markDirtyAndEmit();
  }

  setCursorVisible(visible: boolean) {
    this.buffer.setCursorVisible(visible);
    this.history.push({
      type: "setCursorVisible",
      visible
    });
    this.markDirtyAndEmit();
  }

  setCursorMode(mode: CursorMode) {
    this.buffer.setCursorMode(mode);
    this.history.push({
      type: "setCursorMode",
      mode
    });
    this.markDirtyAndEmit();
  }

  getSnapshot(): RetroLcdScreenSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = this.buffer.getSnapshot();
    }

    return this.cachedSnapshot;
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
        case "writeMany":
          for (const chunk of operation.chunks) {
            const normalized = normalizeWriteChunk(chunk);
            this.buffer.write(normalized.data, normalized.options);
          }
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

  private markDirtyAndEmit() {
    this.cachedSnapshot = null;
    this.emit();
  }

  private emit() {
    if (this.notificationSuspendDepth > 0) {
      this.hasPendingNotification = true;
      return;
    }

    this.emitNow();
  }

  private emitNow() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const createRetroLcdController = (
  options: Partial<RetroLcdScreenBufferOptions> = {}
): RetroLcdController => new RetroLcdControllerStore(options);
