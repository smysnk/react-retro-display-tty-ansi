export type RetroLcdTerminalSessionState = "idle" | "connecting" | "open" | "closed" | "error";

export type RetroLcdTerminalSessionGeometry = {
  rows: number;
  cols: number;
};

export type RetroLcdTerminalSessionEvent =
  | { type: "connecting" }
  | { type: "open" }
  | { type: "ready"; pid?: number | null }
  | { type: "data"; data: string }
  | { type: "title"; title: string }
  | { type: "bell" }
  | { type: "exit"; exitCode: number | null; signal: string | null }
  | { type: "close"; code: number; reason: string; wasClean: boolean }
  | { type: "error"; message: string; error?: unknown };

export type RetroLcdTerminalSessionListener = (event: RetroLcdTerminalSessionEvent) => void;

export type RetroLcdTerminalSession = {
  connect: (geometry: RetroLcdTerminalSessionGeometry) => void;
  writeInput: (data: string | Uint8Array) => void;
  resize: (rows: number, cols: number) => void;
  subscribe: (listener: RetroLcdTerminalSessionListener) => () => void;
  close: () => void;
  getState: () => RetroLcdTerminalSessionState;
};

export type RetroScreenTerminalSessionState = RetroLcdTerminalSessionState;
export type RetroScreenTerminalSessionGeometry = RetroLcdTerminalSessionGeometry;
export type RetroScreenTerminalSessionEvent = RetroLcdTerminalSessionEvent;
export type RetroScreenTerminalSessionListener = RetroLcdTerminalSessionListener;
export type RetroScreenTerminalSession = RetroLcdTerminalSession;
