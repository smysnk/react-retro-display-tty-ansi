import type { CursorMode } from "../types";

export type RetroLcdCellIntensity = "normal" | "bold" | "faint";

export type RetroLcdCellStyle = {
  intensity: RetroLcdCellIntensity;
  inverse: boolean;
  conceal: boolean;
  blink: boolean;
};

export type RetroLcdCell = {
  char: string;
  style: RetroLcdCellStyle;
};

export type RetroLcdCursorState = {
  row: number;
  col: number;
  visible: boolean;
  mode: CursorMode;
};

export type RetroLcdScreenBufferOptions = {
  rows: number;
  cols: number;
  scrollback?: number;
  tabWidth?: number;
  cursorMode?: CursorMode;
};

export type RetroLcdScreenSnapshot = {
  rows: number;
  cols: number;
  lines: string[];
  rawLines: string[];
  cells: RetroLcdCell[][];
  scrollback: string[];
  cursor: RetroLcdCursorState;
};

export type RetroLcdWriteOptions = {
  appendNewline?: boolean;
};
