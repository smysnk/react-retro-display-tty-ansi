export type RetroScreenConformanceClassification =
  | "implemented"
  | "intentionally-ignored"
  | "host-only"
  | "deferred";

export type RetroScreenConformanceChunkMode = "fixture" | "joined" | "byte" | "random";

export type RetroScreenNormalizedColor =
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

export type RetroScreenNormalizedCellStyle = {
  bold: boolean;
  faint: boolean;
  inverse: boolean;
  conceal: boolean;
  blink: boolean;
  foreground: RetroScreenNormalizedColor;
  background: RetroScreenNormalizedColor;
};

export type RetroScreenNormalizedCell = {
  char: string;
  width: number;
  style: RetroScreenNormalizedCellStyle;
};

export type RetroScreenNormalizedCursorState = {
  row: number;
  col: number;
  visible: boolean | null;
};

export type RetroScreenNormalizedModes = {
  insertMode: boolean | null;
  originMode: boolean | null;
  wraparoundMode: boolean | null;
};

export type RetroScreenNormalizedTerminalSnapshot = {
  source: "retro-lcd" | "xterm-headless" | "xterm-pty";
  rows: number;
  cols: number;
  viewportY: number;
  baseY: number;
  lines: string[];
  rawLines: string[];
  wrapped: boolean[];
  cells: RetroScreenNormalizedCell[][];
  scrollback: string[];
  cursor: RetroScreenNormalizedCursorState;
  pendingWrap: boolean | null;
  modes: RetroScreenNormalizedModes;
};

export type RetroScreenTerminalFixture = {
  name: string;
  description: string;
  classification: RetroScreenConformanceClassification;
  rows: number;
  cols: number;
  scrollback?: number;
  chunks: string[];
  chunkModes?: RetroScreenConformanceChunkMode[];
  randomChunkSeeds?: number[];
};

export type RetroScreenFixtureRunResult = {
  chunkMode: RetroScreenConformanceChunkMode;
  chunkLabel: string;
  randomSeed?: number;
  resolvedChunks: string[];
  reproduction: string;
  fixture: RetroScreenTerminalFixture;
  retroScreen: RetroScreenNormalizedTerminalSnapshot;
  xterm: RetroScreenNormalizedTerminalSnapshot;
  diffs: string[];
};

export type RetroScreenByteParityFixture = {
  name: string;
  description: string;
  rows: number;
  cols: number;
  scrollback?: number;
  bytes: Uint8Array;
};

export type RetroScreenByteParityAdapter = {
  source: RetroScreenNormalizedTerminalSnapshot["source"];
  reset?: () => void | Promise<void>;
  write: (chunk: string) => void | Promise<void>;
  snapshot: () =>
    | RetroScreenNormalizedTerminalSnapshot
    | Promise<RetroScreenNormalizedTerminalSnapshot>;
  dispose?: () => void | Promise<void>;
};

export type RetroScreenByteParityMismatch = {
  offset: number;
  byte: number;
  byteHex: string;
  bytePreview: string;
  diffs: string[];
  retroScreen: RetroScreenNormalizedTerminalSnapshot;
  reference: RetroScreenNormalizedTerminalSnapshot;
};

export type RetroScreenByteParityRunResult = {
  fixture: RetroScreenByteParityFixture;
  stepsMatched: number;
  reproduction: string;
  mismatch: RetroScreenByteParityMismatch | null;
};
