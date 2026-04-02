import type { CursorMode } from "../types";

export type RetroScreenCellIntensity = "normal" | "bold" | "faint";

export type RetroScreenTerminalColor =
  | {
      mode: "default";
      value: 0;
    }
  | {
      mode: "palette";
      value: number;
    }
  | {
      mode: "rgb";
      value: number;
    };

export type RetroScreenCellStyle = {
  intensity: RetroScreenCellIntensity;
  bold: boolean;
  faint: boolean;
  inverse: boolean;
  conceal: boolean;
  blink: boolean;
  foreground: RetroScreenTerminalColor;
  background: RetroScreenTerminalColor;
};

export type RetroScreenCell = {
  char: string;
  style: RetroScreenCellStyle;
  written?: boolean;
};

export type RetroScreenCursorState = {
  row: number;
  col: number;
  visible: boolean;
  mode: CursorMode;
};

export type RetroScreenTerminalMouseTrackingMode = "none" | "vt200" | "drag" | "any";
export type RetroScreenTerminalMouseProtocol = "none" | "sgr";

export type RetroScreenTerminalModes = {
  insertMode: boolean;
  originMode: boolean;
  wraparoundMode: boolean;
  applicationCursorKeysMode: boolean;
  bracketedPasteMode: boolean;
  focusReportingMode: boolean;
  alternateScreenBufferMode: boolean;
  mouseTrackingMode: RetroScreenTerminalMouseTrackingMode;
  mouseProtocol: RetroScreenTerminalMouseProtocol;
};

export type RetroScreenScreenBufferOptions = {
  rows: number;
  cols: number;
  scrollback?: number;
  tabWidth?: number;
  cursorMode?: CursorMode;
};

export type RetroScreenScreenSnapshot = {
  rows: number;
  cols: number;
  lines: string[];
  rawLines: string[];
  cells: RetroScreenCell[][];
  scrollback: string[];
  scrollbackCells: RetroScreenCell[][];
  cursor: RetroScreenCursorState;
  pendingWrap: boolean;
  modes: RetroScreenTerminalModes;
};

export type RetroScreenWriteOptions = {
  appendNewline?: boolean;
};
