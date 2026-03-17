import type { RetroLcdGeometry } from "../types";

export type MeasureGridInput = {
  innerWidth: number;
  innerHeight: number;
  cellWidth: number;
  cellHeight: number;
};

export const measureGrid = ({
  innerWidth,
  innerHeight,
  cellWidth,
  cellHeight
}: MeasureGridInput): RetroLcdGeometry => ({
  rows: Math.max(1, Math.floor(innerHeight / Math.max(1, cellHeight))),
  cols: Math.max(1, Math.floor(innerWidth / Math.max(1, cellWidth))),
  cellWidth,
  cellHeight,
  innerWidth,
  innerHeight
});
