export type RetroLcdTerminalPasteEncodingOptions = {
  bracketedPasteMode?: boolean;
};

export const encodeRetroLcdTerminalPaste = (
  text: string,
  options: RetroLcdTerminalPasteEncodingOptions = {}
) => {
  if (!options.bracketedPasteMode) {
    return text;
  }

  return `\u001b[200~${text}\u001b[201~`;
};

export const encodeRetroScreenTerminalPaste = encodeRetroLcdTerminalPaste;

export const encodeRetroLcdTerminalFocusReport = (focused: boolean) =>
  focused ? "\u001b[I" : "\u001b[O";

export const encodeRetroScreenTerminalFocusReport = encodeRetroLcdTerminalFocusReport;
