import { useEffect, useState } from "react";
import { createRetroScreenController } from "../core/terminal/controller";
import { normalizeRetroScreenSnapshot } from "../core/terminal/conformance/normalize-retro-lcd";
import type { RetroScreenNormalizedTerminalSnapshot } from "../core/terminal/conformance/types";
import { RetroScreen } from "../react/RetroScreen";

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 12;
const DEFAULT_SCROLLBACK = 200;

const byteToChunk = (byte: number) => String.fromCharCode(byte & 0xff);

export type RetroScreenAnsiParityHarnessGeometry = {
  rows?: number;
  cols?: number;
};

export type RetroScreenAnsiParityHarnessApi = {
  reset: (geometry?: RetroScreenAnsiParityHarnessGeometry) => Promise<void>;
  writeByte: (byte: number) => Promise<void>;
  writeBytes: (bytes: readonly number[]) => Promise<void>;
  flush: () => Promise<void>;
  snapshot: () => RetroScreenNormalizedTerminalSnapshot;
};

declare global {
  interface Window {
    __RETRO_SCREEN_ANSI_PARITY__?: RetroScreenAnsiParityHarnessApi;
  }
}

export function AnsiParityHarness({
  rows = DEFAULT_ROWS,
  cols = DEFAULT_COLS
}: {
  rows?: number;
  cols?: number;
}) {
  const [geometry, setGeometry] = useState({
    rows,
    cols
  });
  const [controller] = useState(() =>
    createRetroScreenController({
      rows,
      cols,
      scrollback: DEFAULT_SCROLLBACK
    })
  );

  const applyGeometry = (nextRows: number, nextCols: number) => {
    controller.batch(() => {
      controller.reset();
      controller.resize(nextRows, nextCols);
      controller.setCursorMode("solid");
      controller.setCursorVisible(true);
    });
    setGeometry({
      rows: nextRows,
      cols: nextCols
    });
  };

  useEffect(() => {
    applyGeometry(rows, cols);
  }, [cols, controller, rows]);

  useEffect(() => {
    const api: RetroScreenAnsiParityHarnessApi = {
      reset: async (nextGeometry) => {
        applyGeometry(nextGeometry?.rows ?? rows, nextGeometry?.cols ?? cols);
      },
      writeByte: async (byte: number) => {
        controller.write(byteToChunk(byte));
      },
      writeBytes: async (bytes: readonly number[]) => {
        controller.writeMany(bytes.map((byte) => byteToChunk(byte)));
      },
      flush: async () => {
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
      },
      snapshot: () => normalizeRetroScreenSnapshot(controller.getSnapshot())
    };

    window.__RETRO_SCREEN_ANSI_PARITY__ = api;

    return () => {
      if (window.__RETRO_SCREEN_ANSI_PARITY__ === api) {
        delete window.__RETRO_SCREEN_ANSI_PARITY__;
      }
    };
  }, [cols, controller, rows]);

  return (
    <div style={{ width: "100%", minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <RetroScreen
        mode="terminal"
        controller={controller}
        gridMode="static"
        rows={geometry.rows}
        cols={geometry.cols}
        displayLayoutMode="fit-width"
        style={{ width: "min(92vw, 960px)", height: "min(72vh, 520px)" }}
      />
    </div>
  );
}
