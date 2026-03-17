import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { measureGrid } from "../core/geometry/measure-grid";
import type { RetroLcdGeometry } from "../core/types";

const DEFAULT_GEOMETRY = measureGrid({
  innerWidth: 560,
  innerHeight: 220,
  cellWidth: 12,
  cellHeight: 24
});

type UseRetroLcdGeometryOptions = {
  screenRef: RefObject<HTMLElement | null>;
  probeRef: RefObject<HTMLElement | null>;
  onGeometryChange?: (geometry: RetroLcdGeometry) => void;
};

const measureCurrentGeometry = ({
  screenRef,
  probeRef
}: Pick<UseRetroLcdGeometryOptions, "screenRef" | "probeRef">): RetroLcdGeometry => {
  const screenNode = screenRef.current;
  const probeNode = probeRef.current;

  if (!screenNode || !probeNode) {
    return DEFAULT_GEOMETRY;
  }

  const screenRect = screenNode.getBoundingClientRect();
  const probeRect = probeNode.getBoundingClientRect();

  if (screenRect.width <= 0 || screenRect.height <= 0) {
    return DEFAULT_GEOMETRY;
  }

  const cellWidth = probeRect.width > 0 ? probeRect.width : DEFAULT_GEOMETRY.cellWidth;
  const cellHeight = probeRect.height > 0 ? probeRect.height : DEFAULT_GEOMETRY.cellHeight;

  return measureGrid({
    innerWidth: Math.max(0, screenRect.width),
    innerHeight: Math.max(0, screenRect.height),
    cellWidth,
    cellHeight
  });
};

export const useRetroLcdGeometry = ({
  screenRef,
  probeRef,
  onGeometryChange
}: UseRetroLcdGeometryOptions) => {
  const [geometry, setGeometry] = useState(DEFAULT_GEOMETRY);

  useLayoutEffect(() => {
    setGeometry(measureCurrentGeometry({ screenRef, probeRef }));
  }, [screenRef, probeRef]);

  useEffect(() => {
    const screenNode = screenRef.current;

    if (!screenNode || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      setGeometry(measureCurrentGeometry({ screenRef, probeRef }));
    });

    observer.observe(screenNode);
    return () => observer.disconnect();
  }, [probeRef, screenRef]);

  useEffect(() => {
    onGeometryChange?.(geometry);
  }, [geometry, onGeometryChange]);

  const cssVars = useMemo(
    () =>
      ({
        "--retro-lcd-cell-width": `${geometry.cellWidth}px`,
        "--retro-lcd-cell-height": `${geometry.cellHeight}px`
      }) as CSSProperties,
    [geometry.cellHeight, geometry.cellWidth]
  );

  return {
    geometry,
    cssVars
  };
};
