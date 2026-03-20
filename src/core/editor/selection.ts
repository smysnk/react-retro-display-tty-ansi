export type RetroLcdTextSelection = {
  start: number;
  end: number;
};

const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}_]/u;

export const clampRetroLcdTextOffset = (value: number, textLength: number) => {
  const nextValue = Math.floor(Number.isFinite(value) ? value : 0);
  return Math.max(0, Math.min(textLength, nextValue));
};

const isWordCharacter = (character: string) => WORD_CHARACTER_PATTERN.test(character);

export const normalizeRetroLcdTextSelection = (
  selection: RetroLcdTextSelection,
  textLength: number
): RetroLcdTextSelection => {
  const start = clampRetroLcdTextOffset(selection.start, textLength);
  const end = clampRetroLcdTextOffset(selection.end, textLength);

  if (start <= end) {
    return { start, end };
  }

  return {
    start: end,
    end: start
  };
};

export const createRetroLcdTextSelection = (
  start: number,
  end = start,
  textLength = Number.MAX_SAFE_INTEGER
): RetroLcdTextSelection =>
  normalizeRetroLcdTextSelection(
    {
      start,
      end
    },
    textLength
  );

export const findRetroLcdPreviousWordBoundary = (value: string, offset: number) => {
  let index = clampRetroLcdTextOffset(offset, value.length);

  while (index > 0 && !isWordCharacter(value[index - 1] ?? "")) {
    index -= 1;
  }

  while (index > 0 && isWordCharacter(value[index - 1] ?? "")) {
    index -= 1;
  }

  return index;
};

export const findRetroLcdNextWordBoundary = (value: string, offset: number) => {
  let index = clampRetroLcdTextOffset(offset, value.length);

  while (index < value.length && !isWordCharacter(value[index] ?? "")) {
    index += 1;
  }

  while (index < value.length && isWordCharacter(value[index] ?? "")) {
    index += 1;
  }

  return index;
};

export const getRetroLcdWordSelectionAtOffset = (
  value: string,
  offset: number
): RetroLcdTextSelection => {
  if (value.length === 0) {
    return {
      start: 0,
      end: 0
    };
  }

  const clampedOffset = clampRetroLcdTextOffset(offset, value.length);
  const currentCharacter =
    clampedOffset < value.length ? value[clampedOffset] ?? "" : "";
  const previousCharacter = clampedOffset > 0 ? value[clampedOffset - 1] ?? "" : "";

  if (!isWordCharacter(currentCharacter) && !isWordCharacter(previousCharacter)) {
    return {
      start: clampedOffset,
      end: clampedOffset
    };
  }

  const seedOffset =
    clampedOffset < value.length && isWordCharacter(currentCharacter)
      ? clampedOffset
      : clampedOffset - 1;

  const start = findRetroLcdPreviousWordBoundary(value, seedOffset + 1);
  const end = findRetroLcdNextWordBoundary(value, seedOffset);

  return {
    start,
    end
  };
};

export const isRetroLcdTextSelectionCollapsed = (selection: RetroLcdTextSelection) =>
  selection.start === selection.end;

export const collapseRetroLcdTextSelectionToStart = (
  selection: RetroLcdTextSelection
): RetroLcdTextSelection => ({
  start: selection.start,
  end: selection.start
});

export const collapseRetroLcdTextSelectionToEnd = (
  selection: RetroLcdTextSelection
): RetroLcdTextSelection => ({
  start: selection.end,
  end: selection.end
});

export const deleteRetroLcdSelectedText = (
  value: string,
  selection: RetroLcdTextSelection
): {
  value: string;
  selection: RetroLcdTextSelection;
  deletedText: string;
} => {
  const normalized = normalizeRetroLcdTextSelection(selection, value.length);
  const deletedText = value.slice(normalized.start, normalized.end);
  const nextValue = `${value.slice(0, normalized.start)}${value.slice(normalized.end)}`;
  const nextSelection = collapseRetroLcdTextSelectionToStart(normalized);

  return {
    value: nextValue,
    selection: nextSelection,
    deletedText
  };
};

export const replaceRetroLcdSelectedText = (
  value: string,
  selection: RetroLcdTextSelection,
  replacement: string
): {
  value: string;
  selection: RetroLcdTextSelection;
  deletedText: string;
} => {
  const normalized = normalizeRetroLcdTextSelection(selection, value.length);
  const deletedText = value.slice(normalized.start, normalized.end);
  const nextValue = `${value.slice(0, normalized.start)}${replacement}${value.slice(normalized.end)}`;
  const nextOffset = normalized.start + replacement.length;

  return {
    value: nextValue,
    selection: {
      start: nextOffset,
      end: nextOffset
    },
    deletedText
  };
};
