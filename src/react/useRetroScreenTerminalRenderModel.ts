import { startTransition, useEffect, useMemo, useState } from "react";
import type {
  CursorMode,
  RetroScreenController,
  RetroScreenGeometry,
  RetroScreenTerminalModeProps
} from "../core/types";
import { buildTerminalSnapshot } from "./retro-screen-render-model";
import type { RetroScreenScreenSnapshot } from "../core/terminal/types";

type UseRetroScreenTerminalRenderModelArgs = {
  terminalProps: RetroScreenTerminalModeProps | null;
  geometry: RetroScreenGeometry;
  cursorMode: CursorMode;
  requestedCursorMode?: CursorMode;
  internalController: RetroScreenController;
};

export const useRetroScreenTerminalRenderModel = ({
  terminalProps,
  geometry,
  cursorMode,
  requestedCursorMode,
  internalController
  }: UseRetroScreenTerminalRenderModelArgs): {
  snapshot: RetroScreenScreenSnapshot;
  terminalController: RetroScreenController | null;
} => {
  const terminalController =
    terminalProps?.controller ?? (terminalProps ? internalController : null);
  const initialText = terminalProps?.session
    ? ""
    : terminalProps?.value ?? terminalProps?.initialBuffer ?? "";
  const [snapshot, setSnapshot] = useState<RetroScreenScreenSnapshot>(() =>
    buildTerminalSnapshot({
      text: initialText,
      rows: geometry.rows,
      cols: geometry.cols,
      cursorMode,
      scrollback: terminalProps?.bufferSize
    })
  );

  useEffect(() => {
    if (!terminalController) {
      return;
    }

    terminalController.batch(() => {
      terminalController.resize(geometry.rows, geometry.cols);
      if (requestedCursorMode) {
        terminalController.setCursorMode(requestedCursorMode);
      }
    });
  }, [geometry.cols, geometry.rows, requestedCursorMode, terminalController]);

  useEffect(() => {
    if (!terminalProps || terminalProps.controller || terminalProps.session) {
      return;
    }

    internalController.batch(() => {
      internalController.reset();
      internalController.setCursorMode(cursorMode);

      const initialText = terminalProps.value ?? terminalProps.initialBuffer ?? "";
      if (initialText) {
        internalController.write(initialText);
      }
    });
  }, [
    cursorMode,
    internalController,
    terminalProps?.controller,
    terminalProps?.initialBuffer,
    terminalProps?.value
  ]);

  useEffect(() => {
    if (terminalController) {
      const syncSnapshot = () => {
        const nextSnapshot = terminalController.getSnapshot();
        startTransition(() => {
          setSnapshot(nextSnapshot);
        });
      };

      syncSnapshot();
      return terminalController.subscribe(syncSnapshot);
    }

    setSnapshot(
      buildTerminalSnapshot({
        text: terminalProps?.session ? "" : terminalProps?.value ?? terminalProps?.initialBuffer ?? "",
        rows: geometry.rows,
        cols: geometry.cols,
        cursorMode,
        scrollback: terminalProps?.bufferSize
      })
    );
  }, [
    cursorMode,
    geometry.cols,
    geometry.rows,
    terminalProps?.bufferSize,
    terminalController,
    terminalProps?.initialBuffer,
    terminalProps?.session,
    terminalProps?.value
  ]);

  return useMemo(
    () => ({
      snapshot,
      terminalController
    }),
    [snapshot, terminalController]
  );
};
