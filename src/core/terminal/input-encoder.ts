import type { RetroLcdTerminalHostKeyEvent } from "./host-adapter";

const ESC = "\u001b";
const DEL = "\u007f";

export type RetroLcdTerminalInputEncodingOptions = {
  applicationCursorKeysMode?: boolean;
};

const TILDE_KEY_CODES: Record<string, number> = {
  Insert: 2,
  Delete: 3,
  PageUp: 5,
  PageDown: 6,
  F5: 15,
  F6: 17,
  F7: 18,
  F8: 19,
  F9: 20,
  F10: 21,
  F11: 23,
  F12: 24
};

const CSI_CURSOR_KEYS: Record<string, string> = {
  ArrowUp: "A",
  ArrowDown: "B",
  ArrowRight: "C",
  ArrowLeft: "D",
  Home: "H",
  End: "F"
};

const SS3_FUNCTION_KEYS: Record<string, string> = {
  F1: "P",
  F2: "Q",
  F3: "R",
  F4: "S"
};

const isPrintableKey = (key: string) => key.length === 1;

const getModifierParameter = (event: RetroLcdTerminalHostKeyEvent) => {
  let value = 1;

  if (event.shiftKey) {
    value += 1;
  }

  if (event.altKey) {
    value += 2;
  }

  if (event.ctrlKey) {
    value += 4;
  }

  return value;
};

const encodeModifiedCursorKey = (final: string, modifier: number) =>
  `${ESC}[1;${modifier}${final}`;

const encodeModifiedTildeKey = (code: number, modifier: number) =>
  `${ESC}[${code};${modifier}~`;

const normalizeMetaBehavior = (event: RetroLcdTerminalHostKeyEvent) =>
  event.metaKey && !event.altKey && !event.ctrlKey;

const encodeCtrlPrintableKey = (key: string) => {
  const normalized = key.toUpperCase();

  if (normalized >= "A" && normalized <= "Z") {
    return String.fromCharCode(normalized.charCodeAt(0) - 64);
  }

  switch (key) {
    case "@":
    case " ":
      return "\u0000";
    case "[":
      return ESC;
    case "\\":
      return "\u001c";
    case "]":
      return "\u001d";
    case "^":
      return "\u001e";
    case "_":
    case "/":
      return "\u001f";
    case "?":
      return DEL;
    default:
      return null;
  }
};

export const encodeRetroLcdTerminalInput = (
  event: RetroLcdTerminalHostKeyEvent,
  options: RetroLcdTerminalInputEncodingOptions = {}
): string | null => {
  if (normalizeMetaBehavior(event)) {
    return null;
  }

  const modifier = getModifierParameter(event);
  const altPrefix = event.altKey && modifier === (event.ctrlKey ? 7 : event.shiftKey ? 4 : 3);

  if (isPrintableKey(event.key)) {
    const ctrlEncoded = event.ctrlKey ? encodeCtrlPrintableKey(event.key) : event.key;

    if (!ctrlEncoded) {
      return null;
    }

    return event.altKey ? `${ESC}${ctrlEncoded}` : ctrlEncoded;
  }

  switch (event.key) {
    case "Enter":
      return event.altKey ? `${ESC}\r` : "\r";
    case "Backspace":
      return event.altKey ? `${ESC}${DEL}` : DEL;
    case "Tab":
      if (event.shiftKey || modifier > 1) {
        return modifier > 1 ? `${ESC}[1;${modifier}Z` : `${ESC}[Z`;
      }
      return event.altKey ? `${ESC}\t` : "\t";
    case "Escape":
      return `${ESC}${event.altKey ? ESC : ""}`;
    default:
      break;
  }

  const cursorFinal = CSI_CURSOR_KEYS[event.key];
  if (cursorFinal) {
    if (options.applicationCursorKeysMode && modifier === 1) {
      return `${ESC}O${cursorFinal}`;
    }

    return modifier > 1 ? encodeModifiedCursorKey(cursorFinal, modifier) : `${ESC}[${cursorFinal}`;
  }

  const tildeCode = TILDE_KEY_CODES[event.key];
  if (tildeCode) {
    return modifier > 1 ? encodeModifiedTildeKey(tildeCode, modifier) : `${ESC}[${tildeCode}~`;
  }

  const ss3Key = SS3_FUNCTION_KEYS[event.key];
  if (ss3Key) {
    return modifier > 1 ? `${ESC}[1;${modifier}${ss3Key}` : `${ESC}O${ss3Key}`;
  }

  if (event.ctrlKey) {
    switch (event.key) {
      case "2":
        return "\u0000";
      case "6":
        return "\u001e";
      case "-":
        return "\u001f";
      default:
        break;
    }
  }

  return altPrefix ? `${ESC}${event.key}` : null;
};

export const encodeRetroScreenTerminalInput = encodeRetroLcdTerminalInput;
