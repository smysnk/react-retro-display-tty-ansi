import type {
  CursorMode,
  RetroScreenPromptCommandResult
} from "../types";
import { RetroScreenScreenBuffer } from "./screen-buffer";
import type {
  RetroScreenScreenBufferOptions,
  RetroScreenScreenSnapshot,
  RetroScreenWriteOptions
} from "./types";

type PromptTranscriptOperation = {
  data: string;
  options?: RetroScreenWriteOptions;
};

export type RetroScreenPromptSessionOptions = Partial<RetroScreenScreenBufferOptions> & {
  promptChar?: string;
  acceptanceText?: string;
  rejectionText?: string;
  onCommand?: (
    command: string
  ) => RetroScreenPromptCommandResult | Promise<RetroScreenPromptCommandResult>;
};

export type RetroScreenPromptSession = {
  setDraft: (draft: string) => void;
  getDraft: () => string;
  setSelection: (offset: number) => void;
  setFocused: (focused: boolean) => void;
  isAwaitingResponse: () => boolean;
  resize: (rows: number, cols: number) => void;
  setCursorMode: (mode: CursorMode) => void;
  updateOptions: (options: Partial<RetroScreenPromptSessionOptions>) => void;
  clear: () => void;
  reset: () => void;
  submit: (command?: string) => Promise<RetroScreenPromptCommandResult>;
  getSnapshot: () => RetroScreenScreenSnapshot;
  subscribe: (listener: () => void) => () => void;
};

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 46;
const DEFAULT_ACCEPTANCE_TEXT = "OK";
const DEFAULT_REJECTION_TEXT = "ERROR";

const clampDimension = (value: number, fallback: number) => {
  const nextValue = Math.floor(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallback;
};

const clampSelection = (value: number, draft: string) =>
  Math.max(0, Math.min(draft.length, Math.floor(value) || 0));

const normalizeResponseLines = (response?: string | string[]) => {
  if (!response) {
    return [];
  }

  const values = Array.isArray(response) ? response : [response];
  return values.flatMap((value) => value.split(/\r?\n/u));
};

class RetroScreenPromptSessionStore implements RetroScreenPromptSession {
  private readonly listeners = new Set<() => void>();
  private readonly transcript: PromptTranscriptOperation[] = [];
  private rows: number;
  private cols: number;
  private scrollback?: number;
  private tabWidth?: number;
  private cursorMode: CursorMode;
  private promptChar: string;
  private acceptanceText: string;
  private rejectionText: string;
  private onCommand?: RetroScreenPromptSessionOptions["onCommand"];
  private draft = "";
  private selection = 0;
  private focused = false;
  private awaitingResponse = false;

  constructor(options: RetroScreenPromptSessionOptions = {}) {
    this.rows = clampDimension(options.rows ?? DEFAULT_ROWS, DEFAULT_ROWS);
    this.cols = clampDimension(options.cols ?? DEFAULT_COLS, DEFAULT_COLS);
    this.scrollback = options.scrollback;
    this.tabWidth = options.tabWidth;
    this.cursorMode = options.cursorMode ?? "solid";
    this.promptChar = options.promptChar ?? ">";
    this.acceptanceText = options.acceptanceText ?? DEFAULT_ACCEPTANCE_TEXT;
    this.rejectionText = options.rejectionText ?? DEFAULT_REJECTION_TEXT;
    this.onCommand = options.onCommand;
  }

  setDraft(draft: string) {
    this.draft = draft;
    this.selection = clampSelection(this.selection, this.draft);
    this.emit();
  }

  getDraft() {
    return this.draft;
  }

  setSelection(offset: number) {
    this.selection = clampSelection(offset, this.draft);
    this.emit();
  }

  setFocused(focused: boolean) {
    this.focused = focused;
    this.emit();
  }

  isAwaitingResponse() {
    return this.awaitingResponse;
  }

  resize(rows: number, cols: number) {
    const nextRows = clampDimension(rows, this.rows);
    const nextCols = clampDimension(cols, this.cols);

    if (nextRows === this.rows && nextCols === this.cols) {
      return;
    }

    this.rows = nextRows;
    this.cols = nextCols;
    this.emit();
  }

  setCursorMode(mode: CursorMode) {
    this.cursorMode = mode;
    this.emit();
  }

  updateOptions(options: Partial<RetroScreenPromptSessionOptions>) {
    if (options.promptChar !== undefined) {
      this.promptChar = options.promptChar || ">";
    }

    if (options.acceptanceText !== undefined) {
      this.acceptanceText = options.acceptanceText || DEFAULT_ACCEPTANCE_TEXT;
    }

    if (options.rejectionText !== undefined) {
      this.rejectionText = options.rejectionText || DEFAULT_REJECTION_TEXT;
    }

    if (options.onCommand !== undefined) {
      this.onCommand = options.onCommand;
    }

    if (options.scrollback !== undefined) {
      this.scrollback = options.scrollback;
    }

    if (options.tabWidth !== undefined) {
      this.tabWidth = options.tabWidth;
    }

    if (options.rows !== undefined || options.cols !== undefined) {
      this.resize(options.rows ?? this.rows, options.cols ?? this.cols);
      return;
    }

    if (options.cursorMode !== undefined) {
      this.setCursorMode(options.cursorMode);
      return;
    }

    this.emit();
  }

  clear() {
    this.transcript.length = 0;
    this.awaitingResponse = false;
    this.emit();
  }

  reset() {
    this.clear();
    this.draft = "";
    this.selection = 0;
    this.focused = false;
    this.cursorMode = "solid";
    this.emit();
  }

  async submit(command = this.draft): Promise<RetroScreenPromptCommandResult> {
    if (this.awaitingResponse) {
      return { accepted: false, response: [this.rejectionText] };
    }

    this.appendTranscript(`${this.promptChar} ${command}`, { appendNewline: true });
    this.draft = "";
    this.selection = 0;
    this.awaitingResponse = true;
    this.emit();

    let result: RetroScreenPromptCommandResult;

    try {
      result = (await this.onCommand?.(command)) ?? { accepted: true };
    } catch {
      result = { accepted: false };
    }

    const statusLine = result.accepted ? this.acceptanceText : this.rejectionText;
    this.appendTranscript(statusLine, { appendNewline: true });

    for (const line of normalizeResponseLines(result.response)) {
      this.appendTranscript(line, { appendNewline: true });
    }

    this.awaitingResponse = false;
    this.emit();
    return result;
  }

  getSnapshot(): RetroScreenScreenSnapshot {
    const renderBuffer = this.createBuffer();

    if (!this.awaitingResponse) {
      const prefix = `${this.promptChar} `;
      const fullPrompt = `${prefix}${this.draft}`;
      renderBuffer.write(fullPrompt);

      if (this.focused) {
        const cursorBuffer = this.createBuffer();
        cursorBuffer.write(`${prefix}${this.draft.slice(0, this.selection)}`);
        const cursor = cursorBuffer.getCursor();
        renderBuffer.moveCursorTo(cursor.row, cursor.col);
        renderBuffer.setCursorVisible(true);
      } else {
        renderBuffer.setCursorVisible(false);
      }
    } else {
      renderBuffer.setCursorVisible(false);
    }

    renderBuffer.setCursorMode(this.cursorMode);
    return renderBuffer.getSnapshot();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private createBuffer() {
    const buffer = new RetroScreenScreenBuffer({
      rows: this.rows,
      cols: this.cols,
      scrollback: this.scrollback,
      tabWidth: this.tabWidth,
      cursorMode: this.cursorMode
    });

    for (const operation of this.transcript) {
      buffer.write(operation.data, operation.options);
    }

    return buffer;
  }

  private appendTranscript(data: string, options?: RetroScreenWriteOptions) {
    this.transcript.push({
      data,
      options
    });
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const createRetroScreenPromptSession = (
  options: RetroScreenPromptSessionOptions = {}
): RetroScreenPromptSession => new RetroScreenPromptSessionStore(options);
