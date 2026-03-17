import { useEffect, useRef } from "react";
import { createRetroLcdController } from "../core/terminal/controller";
import type { RetroLcdController } from "../core/types";
import type { RetroLcdScreenBufferOptions } from "../core/terminal/types";

export const useRetroLcdController = (
  options: Partial<RetroLcdScreenBufferOptions> = {}
): RetroLcdController => {
  const controllerRef = useRef<RetroLcdController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRetroLcdController(options);
  }

  useEffect(() => {
    controllerRef.current?.resize(options.rows ?? 9, options.cols ?? 46);
  }, [options.cols, options.rows]);

  useEffect(() => {
    if (options.cursorMode) {
      controllerRef.current?.setCursorMode(options.cursorMode);
    }
  }, [options.cursorMode]);

  return controllerRef.current;
};
