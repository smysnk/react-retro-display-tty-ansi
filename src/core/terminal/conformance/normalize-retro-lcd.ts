import type { RetroScreenScreenSnapshot, RetroScreenCell } from "../types";
import type {
  RetroScreenNormalizedCell,
  RetroScreenNormalizedCellStyle,
  RetroScreenNormalizedTerminalSnapshot
} from "./types";

const DEFAULT_COLOR = {
  mode: "default" as const,
  value: 0
};

const normalizeCellStyle = (cell: RetroScreenCell): RetroScreenNormalizedCellStyle => ({
  bold: cell.style.bold,
  faint: cell.style.faint,
  inverse: cell.style.inverse,
  conceal: cell.style.conceal,
  blink: cell.style.blink,
  foreground:
    cell.style.foreground.mode === "default" ? DEFAULT_COLOR : { ...cell.style.foreground },
  background:
    cell.style.background.mode === "default" ? DEFAULT_COLOR : { ...cell.style.background }
});

const normalizeCell = (cell: RetroScreenCell): RetroScreenNormalizedCell => ({
  char: cell.char,
  width: 1,
  style: normalizeCellStyle(cell)
});

const normalizeScrollbackLine = (line: RetroScreenCell[]) => {
  let lastVisibleIndex = -1;

  for (let index = 0; index < line.length; index += 1) {
    const cell = line[index];
    if (!cell) {
      continue;
    }

    if (cell.char !== " " || cell.written) {
      lastVisibleIndex = index;
    }
  }

  return line
    .slice(0, lastVisibleIndex + 1)
    .map((cell) => cell.char)
    .join("");
};

export const normalizeRetroScreenSnapshot = (
  snapshot: RetroScreenScreenSnapshot
): RetroScreenNormalizedTerminalSnapshot => ({
  source: "retro-lcd",
  rows: snapshot.rows,
  cols: snapshot.cols,
  viewportY: 0,
  baseY: snapshot.scrollback.length,
  lines: [...snapshot.lines],
  rawLines: [...snapshot.rawLines],
  wrapped: Array.from({ length: snapshot.rows }, () => false),
  cells: snapshot.cells.map((line) => line.map((cell) => normalizeCell(cell))),
  scrollback: snapshot.scrollbackCells.map((line) => normalizeScrollbackLine(line)),
  cursor: {
    row: snapshot.cursor.row,
    col: snapshot.cursor.col,
    visible: snapshot.cursor.visible
  },
  pendingWrap: snapshot.pendingWrap,
  modes: {
    insertMode: snapshot.modes.insertMode,
    originMode: snapshot.modes.originMode,
    wraparoundMode: snapshot.modes.wraparoundMode
  }
});
