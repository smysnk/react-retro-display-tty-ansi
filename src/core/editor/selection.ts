export type RetroScreenTextSelection = {
  start: number;
  end: number;
};

const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}_]/u;

export const clampRetroScreenTextOffset = (value: number, textLength: number) => {
  const nextValue = Math.floor(Number.isFinite(value) ? value : 0);
  return Math.max(0, Math.min(textLength, nextValue));
};

const isWordCharacter = (character: string) => WORD_CHARACTER_PATTERN.test(character);

export const normalizeRetroScreenTextSelection = (
  selection: RetroScreenTextSelection,
  textLength: number
): RetroScreenTextSelection => {
  const start = clampRetroScreenTextOffset(selection.start, textLength);
  const end = clampRetroScreenTextOffset(selection.end, textLength);

  if (start <= end) {
    return { start, end };
  }

  return {
    start: end,
    end: start
  };
};

export const createRetroScreenTextSelection = (
  start: number,
  end = start,
  textLength = Number.MAX_SAFE_INTEGER
): RetroScreenTextSelection =>
  normalizeRetroScreenTextSelection(
    {
      start,
      end
    },
    textLength
  );

export const findRetroScreenPreviousWordBoundary = (value: string, offset: number) => {
  let index = clampRetroScreenTextOffset(offset, value.length);

  while (index > 0 && !isWordCharacter(value[index - 1] ?? "")) {
    index -= 1;
  }

  while (index > 0 && isWordCharacter(value[index - 1] ?? "")) {
    index -= 1;
  }

  return index;
};

export const findRetroScreenNextWordBoundary = (value: string, offset: number) => {
  let index = clampRetroScreenTextOffset(offset, value.length);

  while (index < value.length && !isWordCharacter(value[index] ?? "")) {
    index += 1;
  }

  while (index < value.length && isWordCharacter(value[index] ?? "")) {
    index += 1;
  }

  return index;
};

export const getRetroScreenWordSelectionAtOffset = (
  value: string,
  offset: number
): RetroScreenTextSelection => {
  if (value.length === 0) {
    return {
      start: 0,
      end: 0
    };
  }

  const clampedOffset = clampRetroScreenTextOffset(offset, value.length);
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

  const start = findRetroScreenPreviousWordBoundary(value, seedOffset + 1);
  const end = findRetroScreenNextWordBoundary(value, seedOffset);

  return {
    start,
    end
  };
};

export const isRetroScreenTextSelectionCollapsed = (selection: RetroScreenTextSelection) =>
  selection.start === selection.end;

export const collapseRetroScreenTextSelectionToStart = (
  selection: RetroScreenTextSelection
): RetroScreenTextSelection => ({
  start: selection.start,
  end: selection.start
});

export const collapseRetroScreenTextSelectionToEnd = (
  selection: RetroScreenTextSelection
): RetroScreenTextSelection => ({
  start: selection.end,
  end: selection.end
});

export const deleteRetroScreenSelectedText = (
  value: string,
  selection: RetroScreenTextSelection
): {
  value: string;
  selection: RetroScreenTextSelection;
  deletedText: string;
} => {
  const normalized = normalizeRetroScreenTextSelection(selection, value.length);
  const deletedText = value.slice(normalized.start, normalized.end);
  const nextValue = `${value.slice(0, normalized.start)}${value.slice(normalized.end)}`;
  const nextSelection = collapseRetroScreenTextSelectionToStart(normalized);

  return {
    value: nextValue,
    selection: nextSelection,
    deletedText
  };
};

export const replaceRetroScreenSelectedText = (
  value: string,
  selection: RetroScreenTextSelection,
  replacement: string
): {
  value: string;
  selection: RetroScreenTextSelection;
  deletedText: string;
} => {
  const normalized = normalizeRetroScreenTextSelection(selection, value.length);
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
