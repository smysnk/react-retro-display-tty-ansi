import {
  wrapTextToCellRows,
  wrapTextToColumns
} from "../core/geometry/wrap";
import { normalizeRetroScreenTextSelection, type RetroScreenTextSelection } from "../core/editor/selection";
import { RetroScreenScreenBuffer } from "../core/terminal/screen-buffer";
import type { RetroScreenCell, RetroScreenCellStyle, RetroScreenScreenSnapshot } from "../core/terminal/types";
import type { CursorMode, RetroScreenGeometry, RetroScreenValueModeProps } from "../core/types";

export type RetroScreenCursorRenderState = {
  row: number;
  col: number;
  mode: CursorMode;
};

export type RetroScreenRenderCell = RetroScreenCell & {
  sourceOffset: number | null;
  isSelected: boolean;
};

export type RetroScreenRenderModel = {
  lines: string[];
  cells?: RetroScreenRenderCell[][];
  cursor: RetroScreenCursorRenderState | null;
  isDimmed: boolean;
};

const DEFAULT_RENDER_CELL_STYLE: RetroScreenCellStyle = {
  intensity: "normal",
  bold: false,
  faint: false,
  inverse: false,
  conceal: false,
  blink: false,
  foreground: {
    mode: "default",
    value: 0
  },
  background: {
    mode: "default",
    value: 0
  }
};

const createRenderCell = (
  char: string,
  options: {
    sourceOffset: number | null;
    isSelected?: boolean;
    style?: RetroScreenCellStyle;
  }
): RetroScreenRenderCell => ({
  char,
  style: options.style ?? DEFAULT_RENDER_CELL_STYLE,
  sourceOffset: options.sourceOffset,
  isSelected: Boolean(options.isSelected)
});

export const normalizeLines = (lines: string[], rows: number) => {
  const nextLines = [...lines];

  while (nextLines.length < rows) {
    nextLines.push("");
  }

  return nextLines.slice(0, rows);
};

const normalizeCellRows = <T,>(rowsValue: T[][], rows: number) => {
  const nextRows = [...rowsValue];

  while (nextRows.length < rows) {
    nextRows.push([]);
  }

  return nextRows.slice(0, rows);
};

export const buildTextRenderModel = ({
  text,
  geometry,
  cursorMode,
  cursorOffset,
  cursorVisible,
  dimmed,
  selection,
  includeSourceOffsets
}: {
  text: string;
  geometry: RetroScreenGeometry;
  cursorMode: CursorMode;
  cursorOffset?: number;
  cursorVisible?: boolean;
  dimmed?: boolean;
  selection?: RetroScreenTextSelection | null;
  includeSourceOffsets?: boolean;
}): RetroScreenRenderModel => {
  const normalizedSelection = selection
    ? normalizeRetroScreenTextSelection(selection, text.length)
    : null;
  const wrappedCellRows = wrapTextToCellRows(text, { cols: geometry.cols });
  const totalCells = wrappedCellRows.map((row) =>
    row.map((cell) =>
      createRenderCell(cell.char, {
        sourceOffset: cell.sourceOffset,
        isSelected: normalizedSelection
          ? cell.sourceOffset >= normalizedSelection.start &&
            cell.sourceOffset < normalizedSelection.end
          : false
      })
    )
  );
  const totalLines = totalCells.map((line) => line.map((cell) => cell.char).join(""));
  const shouldExposeCells = Boolean(includeSourceOffsets || normalizedSelection);

  let cursor: RetroScreenCursorRenderState | null = null;
  let windowStart = 0;

  if (cursorVisible) {
    const cursorRows = wrapTextToCellRows(text.slice(0, cursorOffset ?? text.length), {
      cols: geometry.cols
    });
    let cursorRow = cursorRows.length - 1;
    let cursorCol = cursorRows[cursorRow]?.length ?? 0;

    if (cursorCol >= geometry.cols) {
      cursorRow += 1;
      cursorCol = 0;
    }

    while (totalCells.length <= cursorRow) {
      totalCells.push([]);
      totalLines.push("");
    }

    windowStart = Math.min(
      Math.max(0, cursorRow - geometry.rows + 1),
      Math.max(0, totalLines.length - geometry.rows)
    );

    if (cursorRow >= windowStart && cursorRow < windowStart + geometry.rows) {
      cursor = {
        row: cursorRow - windowStart,
        col: cursorCol,
        mode: cursorMode
      };
    }
  } else if (totalLines.length > geometry.rows) {
    windowStart = Math.max(0, totalLines.length - geometry.rows);
  }

  return {
    lines: normalizeLines(totalLines.slice(windowStart, windowStart + geometry.rows), geometry.rows),
    cells: shouldExposeCells
      ? normalizeCellRows(totalCells.slice(windowStart, windowStart + geometry.rows), geometry.rows)
      : undefined,
    cursor,
    isDimmed: Boolean(dimmed)
  };
};

export const buildTerminalSnapshot = ({
  text,
  rows,
  cols,
  cursorMode,
  scrollback
}: {
  text: string;
  rows: number;
  cols: number;
  cursorMode: CursorMode;
  scrollback?: number;
}): RetroScreenScreenSnapshot => {
  const buffer = new RetroScreenScreenBuffer({
    rows,
    cols,
    cursorMode,
    scrollback
  });

  if (text) {
    buffer.write(text);
  }

  return buffer.getSnapshot();
};

const trimRenderedLine = (line: RetroScreenCell[]) =>
  line
    .map((cell) => cell.char)
    .join("")
    .replace(/\s+$/u, "");

export const getSnapshotMaxScrollOffset = (snapshot: RetroScreenScreenSnapshot) =>
  Math.max(0, snapshot.scrollbackCells.length);

export const clampSnapshotScrollOffset = (
  snapshot: RetroScreenScreenSnapshot,
  scrollOffset: number
) => Math.max(0, Math.min(getSnapshotMaxScrollOffset(snapshot), Math.floor(scrollOffset) || 0));

export const snapshotToRenderModel = (
  snapshot: RetroScreenScreenSnapshot,
  options: {
    scrollOffset?: number;
  } = {}
): RetroScreenRenderModel => {
  const scrollOffset = clampSnapshotScrollOffset(snapshot, options.scrollOffset ?? 0);
  const bufferCells = [...snapshot.scrollbackCells, ...snapshot.cells];
  const windowStart = Math.max(0, bufferCells.length - snapshot.rows - scrollOffset);
  const viewportCells = bufferCells.slice(windowStart, windowStart + snapshot.rows);
  const cursorAbsoluteRow = snapshot.scrollbackCells.length + snapshot.cursor.row;
  const cursorVisible =
    snapshot.cursor.visible &&
    cursorAbsoluteRow >= windowStart &&
    cursorAbsoluteRow < windowStart + snapshot.rows;

  return {
    lines: normalizeLines(viewportCells.map((line) => trimRenderedLine(line)), snapshot.rows),
    cells: viewportCells.map((line) =>
      line.map((cell) =>
        createRenderCell(cell.char, {
          sourceOffset: null,
          style: cell.style
        })
      )
    ),
    cursor: cursorVisible
      ? {
          row: cursorAbsoluteRow - windowStart,
          col: snapshot.cursor.col,
          mode: snapshot.cursor.mode
        }
      : null,
    isDimmed: false
  };
};

export const getValueDisplayText = (props: RetroScreenValueModeProps, focused: boolean) => {
  if (props.value.length > 0) {
    return {
      text: props.value,
      dimmed: false
    };
  }

  return {
    text: props.placeholder && !focused ? props.placeholder : "",
    dimmed: Boolean(props.placeholder && !focused)
  };
};

export const getLineDisplayText = (line: string) => (line.length > 0 ? line : "\u00a0");

export const getCellCharacter = (cell: RetroScreenCell) => {
  if (cell.style.conceal) {
    return "\u00a0";
  }

  return cell.char === " " ? "\u00a0" : cell.char;
};
