import { useEffect, useMemo } from "react";
import { createRetroScreenController } from "../core/terminal/controller";
import type { RetroScreenController } from "../core/types";
import type { RetroScreenScreenBufferOptions } from "../core/terminal/types";

export const useRetroScreenController = (
  options: Partial<RetroScreenScreenBufferOptions> = {}
): RetroScreenController => {
  const controller = useMemo(
    () =>
      createRetroScreenController({
        scrollback: options.scrollback,
        tabWidth: options.tabWidth
      }),
    [options.scrollback, options.tabWidth]
  );

  useEffect(() => {
    controller.resize(options.rows ?? 9, options.cols ?? 46);
  }, [controller, options.cols, options.rows]);

  useEffect(() => {
    if (options.cursorMode) {
      controller.setCursorMode(options.cursorMode);
    }
  }, [controller, options.cursorMode]);

  return controller;
};
