export type RetroScreenCsiIdentifier = {
  prefix?: string;
  intermediates?: string;
  final: string;
};

export type RetroScreenEscapeIdentifier = {
  intermediates?: string;
  final: string;
};

export type RetroScreenModeChangeCommand = {
  type: "setMode" | "resetMode";
  identifier: RetroScreenCsiIdentifier;
  params: number[];
};

export type RetroScreenTerminalCommand =
  | { type: "print"; char: string }
  | { type: "lineFeed" }
  | { type: "carriageReturn" }
  | { type: "backspace" }
  | { type: "tab" }
  | { type: "formFeed" }
  | { type: "bell" }
  | { type: "cursorUp"; count: number }
  | { type: "cursorDown"; count: number }
  | { type: "cursorForward"; count: number }
  | { type: "cursorBackward"; count: number }
  | { type: "cursorHorizontalAbsolute"; col: number }
  | { type: "cursorVerticalAbsolute"; row: number }
  | { type: "cursorNextLine"; count: number }
  | { type: "cursorPreviousLine"; count: number }
  | { type: "cursorPosition"; row: number; col: number }
  | { type: "insertChars"; count: number }
  | { type: "deleteChars"; count: number }
  | { type: "eraseChars"; count: number }
  | { type: "repeatPrecedingCharacter"; count: number }
  | { type: "insertLines"; count: number }
  | { type: "deleteLines"; count: number }
  | { type: "scrollUp"; count: number }
  | { type: "scrollDown"; count: number }
  | { type: "setScrollRegion"; top?: number; bottom?: number }
  | { type: "eraseInDisplay"; mode: number }
  | { type: "eraseInLine"; mode: number }
  | { type: "saveCursor"; source: "ansi" | "dec" }
  | { type: "restoreCursor"; source: "ansi" | "dec" }
  | { type: "setGraphicRendition"; params: number[] }
  | { type: "index" }
  | { type: "nextLine" }
  | { type: "reverseIndex" }
  | { type: "resetToInitialState" }
  | RetroScreenModeChangeCommand
  | { type: "unknownEscape"; identifier: RetroScreenEscapeIdentifier }
  | { type: "unknownCsi"; identifier: RetroScreenCsiIdentifier; params: number[] };
