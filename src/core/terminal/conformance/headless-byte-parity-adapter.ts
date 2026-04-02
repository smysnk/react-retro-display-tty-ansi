import { Terminal } from "@xterm/headless";
import { normalizeXtermSnapshot } from "./normalize-xterm";
import type { RetroScreenByteParityAdapter } from "./types";

type HeadlessByteParityAdapterOptions = {
  rows: number;
  cols: number;
  scrollback?: number;
};

export const createHeadlessByteParityAdapter = ({
  rows,
  cols,
  scrollback
}: HeadlessByteParityAdapterOptions): RetroScreenByteParityAdapter => {
  const createTerminal = () =>
    new Terminal({
      allowProposedApi: true,
      rows,
      cols,
      scrollback: scrollback ?? 200
    });

  let terminal = createTerminal();

  return {
    source: "xterm-headless",
    reset: () => {
      terminal.dispose();
      terminal = createTerminal();
    },
    write: async (chunk: string) => {
      await new Promise<void>((resolve) => {
        terminal.write(chunk, () => resolve());
      });
    },
    snapshot: () => normalizeXtermSnapshot(terminal),
    dispose: () => {
      terminal.dispose();
    }
  };
};
