import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler
} from "react";
import type { RetroLcdResizeMode, RetroLcdSharedProps } from "../core/types";

type ResolvedResizeMode = RetroLcdResizeMode | "none";
type ResizeHandle = "right" | "bottom" | "bottom-right" | "left" | "top" | "top-left";
type ResizeState = {
  width: number | null;
  height: number | null;
};

type ActiveResize = {
  width: boolean;
  height: boolean;
  widthDirection: 1 | -1;
  heightDirection: 1 | -1;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const DEFAULT_MIN_WIDTH = 280;
const DEFAULT_MIN_HEIGHT = 220;

const normalizeResizeMode = (
  resizable: RetroLcdSharedProps["resizable"]
): ResolvedResizeMode => {
  if (resizable === true) {
    return "both";
  }

  if (!resizable) {
    return "none";
  }

  return resizable;
};

const getHandleCursor = (handle: ResizeHandle) => {
  switch (handle) {
    case "right":
    case "left":
      return "ew-resize";
    case "bottom":
    case "top":
      return "ns-resize";
    default:
      return "nwse-resize";
  }
};

const getHandleAxes = (handle: ResizeHandle) => {
  switch (handle) {
    case "right":
      return { width: true, height: false, widthDirection: 1, heightDirection: 1 };
    case "left":
      return { width: true, height: false, widthDirection: -1, heightDirection: 1 };
    case "bottom":
      return { width: false, height: true, widthDirection: 1, heightDirection: 1 };
    case "top":
      return { width: false, height: true, widthDirection: 1, heightDirection: -1 };
    case "top-left":
      return { width: true, height: true, widthDirection: -1, heightDirection: -1 };
    default:
      return { width: true, height: true, widthDirection: 1, heightDirection: 1 };
  }
};

export const useRetroLcdResizablePanel = ({
  resizable,
  resizableLeadingEdges
}: Pick<RetroLcdSharedProps, "resizable" | "resizableLeadingEdges">) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef<{
    move: (event: MouseEvent) => void;
    end: () => void;
  } | null>(null);
  const activeResizeRef = useRef<ActiveResize | null>(null);
  const bodyCursorRef = useRef<string | null>(null);
  const bodyUserSelectRef = useRef<string | null>(null);
  const [size, setSize] = useState<ResizeState>({
    width: null,
    height: null
  });
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const resizeMode = normalizeResizeMode(resizable);

  const stopResize = () => {
    if (typeof window !== "undefined" && listenersRef.current) {
      window.removeEventListener("mousemove", listenersRef.current.move);
      window.removeEventListener("mouseup", listenersRef.current.end);
      window.removeEventListener("blur", listenersRef.current.end);
      listenersRef.current = null;
    }

    activeResizeRef.current = null;
    setActiveHandle(null);

    if (typeof document !== "undefined") {
      if (bodyCursorRef.current !== null) {
        document.body.style.cursor = bodyCursorRef.current;
      }

      if (bodyUserSelectRef.current !== null) {
        document.body.style.userSelect = bodyUserSelectRef.current;
      }
    }

    bodyCursorRef.current = null;
    bodyUserSelectRef.current = null;
  };

  useEffect(() => stopResize, []);

  useEffect(() => {
    if (resizeMode === "none") {
      stopResize();
    }
  }, [resizeMode]);

  const beginResize =
    (handle: ResizeHandle): MouseEventHandler<HTMLDivElement> =>
    (event) => {
      if (resizeMode === "none" || event.button !== 0) {
        return;
      }

      const node = rootRef.current;
      if (!node || typeof window === "undefined") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      stopResize();

      const rect = node.getBoundingClientRect();
      const axes = getHandleAxes(handle);

      activeResizeRef.current = {
        ...axes,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height
      };
      setActiveHandle(handle);

      if (typeof document !== "undefined") {
        bodyCursorRef.current = document.body.style.cursor;
        bodyUserSelectRef.current = document.body.style.userSelect;
        document.body.style.cursor = getHandleCursor(handle);
        document.body.style.userSelect = "none";
      }

      const move = (moveEvent: MouseEvent) => {
        const activeResize = activeResizeRef.current;
        if (!activeResize) {
          return;
        }

        const deltaX = moveEvent.clientX - activeResize.startX;
        const deltaY = moveEvent.clientY - activeResize.startY;

        setSize((current) => ({
          width: activeResize.width
            ? Math.max(
                DEFAULT_MIN_WIDTH,
                Math.round(activeResize.startWidth + deltaX * activeResize.widthDirection)
              )
            : current.width,
          height: activeResize.height
            ? Math.max(
                DEFAULT_MIN_HEIGHT,
                Math.round(activeResize.startHeight + deltaY * activeResize.heightDirection)
              )
            : current.height
        }));
      };

      const end = () => {
        stopResize();
      };

      listenersRef.current = {
        move,
        end
      };

      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", end);
      window.addEventListener("blur", end);
    };

  const inlineSizeStyle = useMemo(
    () => {
      const style: CSSProperties = {};

      if (size.width !== null) {
        style.width = `${size.width}px`;
      }

      if (size.height !== null) {
        style.height = `${size.height}px`;
      }

      return style;
    },
    [size.height, size.width]
  );

  return {
    rootRef,
    resizeMode,
    activeHandle,
    isResizable: resizeMode !== "none",
    isResizing: activeHandle !== null,
    hasLeadingHandles: Boolean(resizableLeadingEdges),
    inlineSizeStyle,
    beginResize
  };
};
