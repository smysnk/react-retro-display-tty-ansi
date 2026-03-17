export type WrapTextOptions = {
  cols: number;
  tabWidth?: number;
};

const clampCols = (cols: number) => Math.max(1, Math.floor(cols) || 1);

export const wrapTextToColumns = (text: string, options: WrapTextOptions) => {
  const cols = clampCols(options.cols);
  const tabWidth = Math.max(1, Math.floor(options.tabWidth ?? 4) || 4);
  const lines = [""];
  let col = 0;

  const pushLine = () => {
    lines.push("");
    col = 0;
  };

  const appendChar = (character: string) => {
    if (col >= cols) {
      pushLine();
    }

    lines[lines.length - 1] += character;
    col += 1;
  };

  for (const character of text) {
    if (character === "\n") {
      pushLine();
      continue;
    }

    if (character === "\r") {
      lines[lines.length - 1] = "";
      col = 0;
      continue;
    }

    if (character === "\t") {
      const spaces = tabWidth - (col % tabWidth || 0);

      for (let index = 0; index < spaces; index += 1) {
        appendChar(" ");
      }

      continue;
    }

    appendChar(character);
  }

  return lines;
};
