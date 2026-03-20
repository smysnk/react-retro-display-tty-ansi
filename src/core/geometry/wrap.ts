export type WrapTextOptions = {
  cols: number;
  tabWidth?: number;
};

export type WrappedTextCell = {
  char: string;
  sourceOffset: number;
};

const clampCols = (cols: number) => Math.max(1, Math.floor(cols) || 1);

export const wrapTextToCellRows = (text: string, options: WrapTextOptions) => {
  const cols = clampCols(options.cols);
  const tabWidth = Math.max(1, Math.floor(options.tabWidth ?? 4) || 4);
  const rows: WrappedTextCell[][] = [[]];
  let col = 0;
  let sourceOffset = 0;

  const pushLine = () => {
    rows.push([]);
    col = 0;
  };

  const appendChar = (character: string, nextSourceOffset: number) => {
    if (col >= cols) {
      pushLine();
    }

    rows[rows.length - 1].push({
      char: character,
      sourceOffset: nextSourceOffset
    });
    col += 1;
  };

  for (const character of text) {
    const characterOffset = sourceOffset;
    sourceOffset += character.length;

    if (character === "\n") {
      pushLine();
      continue;
    }

    if (character === "\r") {
      rows[rows.length - 1] = [];
      col = 0;
      continue;
    }

    if (character === "\t") {
      const spaces = tabWidth - (col % tabWidth || 0);

      for (let index = 0; index < spaces; index += 1) {
        appendChar(" ", characterOffset);
      }

      continue;
    }

    appendChar(character, characterOffset);
  }

  return rows;
};

export const wrapTextToColumns = (text: string, options: WrapTextOptions) =>
  wrapTextToCellRows(text, options).map((row) => row.map((cell) => cell.char).join(""));
