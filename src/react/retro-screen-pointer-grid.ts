import type { RetroLcdGeometry } from "../core/types";

export type RetroLcdPointerGridPosition = {
  row: number;
  col: number;
};

const clampCoordinate = (value: number, limit: number) =>
  Math.min(limit, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1));

export const getRetroLcdPointerGridPosition = ({
  clientX,
  clientY,
  rect,
  geometry
}: {
  clientX: number;
  clientY: number;
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;
  geometry: RetroLcdGeometry;
}): RetroLcdPointerGridPosition => {
  const width = Math.max(1, rect.width || geometry.innerWidth);
  const height = Math.max(1, rect.height || geometry.innerHeight);
  const cellWidth = Math.max(1, width / Math.max(1, geometry.cols));
  const cellHeight = Math.max(1, height / Math.max(1, geometry.rows));
  const x = Math.min(Math.max(clientX - rect.left, 0), Math.max(0, width - 1));
  const y = Math.min(Math.max(clientY - rect.top, 0), Math.max(0, height - 1));

  return {
    col: clampCoordinate(Math.floor(x / cellWidth) + 1, geometry.cols),
    row: clampCoordinate(Math.floor(y / cellHeight) + 1, geometry.rows)
  };
};
