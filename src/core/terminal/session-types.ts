export type RetroScreenTerminalSessionState = "idle" | "connecting" | "open" | "closed" | "error";

export type RetroScreenTerminalSessionGeometry = {
  rows: number;
  cols: number;
};

export type RetroScreenTerminalSessionEvent =
  | { type: "connecting" }
  | { type: "open" }
  | { type: "ready"; pid?: number | null }
  | { type: "data"; data: string }
  | { type: "title"; title: string }
  | { type: "bell" }
  | { type: "exit"; exitCode: number | null; signal: string | null }
  | { type: "close"; code: number; reason: string; wasClean: boolean }
  | { type: "error"; message: string; error?: unknown };

export type RetroScreenTerminalSessionListener = (event: RetroScreenTerminalSessionEvent) => void;

export type RetroScreenTerminalSession = {
  connect: (geometry: RetroScreenTerminalSessionGeometry) => void;
  writeInput: (data: string | Uint8Array) => void;
  resize: (rows: number, cols: number) => void;
  subscribe: (listener: RetroScreenTerminalSessionListener) => () => void;
  close: () => void;
  getState: () => RetroScreenTerminalSessionState;
};
