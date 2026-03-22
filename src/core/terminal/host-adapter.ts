export type RetroScreenTerminalHostKeyEvent = {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

export type RetroScreenTerminalOutputAdapter = {
  beginFrame: () => void;
  writeAnsi: (data: string) => void;
  setCursor: (row: number, col: number) => void;
  setCursorVisible: (visible: boolean) => void;
  resetScreen: () => void;
  endFrame: () => void;
};

export type RetroScreenTerminalInputAdapter = {
  onKeyDown?: (event: RetroScreenTerminalHostKeyEvent) => void;
  onKeyUp?: (event: RetroScreenTerminalHostKeyEvent) => void;
  focusTerminal?: () => void;
  blurTerminal?: () => void;
  drainInputQueue?: () => readonly string[];
};

export type RetroScreenTerminalHostAdapter = RetroScreenTerminalOutputAdapter & RetroScreenTerminalInputAdapter;
