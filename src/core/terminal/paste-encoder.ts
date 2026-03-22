export type RetroScreenTerminalPasteEncodingOptions = {
  bracketedPasteMode?: boolean;
};

export const encodeRetroScreenTerminalPaste = (
  text: string,
  options: RetroScreenTerminalPasteEncodingOptions = {}
) => {
  if (!options.bracketedPasteMode) {
    return text;
  }

  return `\u001b[200~${text}\u001b[201~`;
};

export const encodeRetroScreenTerminalFocusReport = (focused: boolean) =>
  focused ? "\u001b[I" : "\u001b[O";
