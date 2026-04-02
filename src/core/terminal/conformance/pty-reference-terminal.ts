import type { RetroScreenByteParityAdapter } from "./types";

export type RetroScreenPtyReferenceTerminalAdapter = RetroScreenByteParityAdapter & {
  source: "xterm-pty";
};

export type RetroScreenPtyReferenceTerminalFactory = (options: {
  rows: number;
  cols: number;
  scrollback?: number;
}) =>
  | RetroScreenPtyReferenceTerminalAdapter
  | Promise<RetroScreenPtyReferenceTerminalAdapter>;
