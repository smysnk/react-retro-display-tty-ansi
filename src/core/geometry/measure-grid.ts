import type { RetroScreenGeometry } from "../types";

export type MeasureGridInput = {
  innerWidth: number;
  innerHeight: number;
  cellWidth: number;
  cellHeight: number;
  fontSize?: number;
};

export type MeasureStaticGridInput = {
  innerWidth: number;
  innerHeight: number;
  rows: number;
  cols: number;
  fontWidthRatio: number;
  fontHeightRatio: number;
};

export const measureGrid = ({
  innerWidth,
  innerHeight,
  cellWidth,
  cellHeight,
  fontSize
}: MeasureGridInput): RetroScreenGeometry => ({
  rows: Math.max(1, Math.floor(innerHeight / Math.max(1, cellHeight))),
  cols: Math.max(1, Math.floor(innerWidth / Math.max(1, cellWidth))),
  cellWidth,
  cellHeight,
  innerWidth,
  innerHeight,
  fontSize: Math.max(1, fontSize ?? cellHeight)
});

export const measureStaticGrid = ({
  innerWidth,
  innerHeight,
  rows,
  cols,
  fontWidthRatio,
  fontHeightRatio
}: MeasureStaticGridInput): RetroScreenGeometry => {
  const resolvedRows = Math.max(1, Math.floor(rows));
  const resolvedCols = Math.max(1, Math.floor(cols));
  const cellWidth = Math.max(1, innerWidth / resolvedCols);
  const cellHeight = Math.max(1, innerHeight / resolvedRows);
  const widthRatio = Math.max(0.01, fontWidthRatio);
  const heightRatio = Math.max(0.01, fontHeightRatio);
  const fontSize = Math.max(1, Math.min(cellWidth / widthRatio, cellHeight / heightRatio));

  return {
    rows: resolvedRows,
    cols: resolvedCols,
    cellWidth,
    cellHeight,
    innerWidth,
    innerHeight,
    fontSize
  };
};
