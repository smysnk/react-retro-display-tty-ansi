import { RetroScreenScreenBuffer } from "../screen-buffer";
import { normalizeRetroScreenSnapshot } from "./normalize-retro-lcd";
import type { RetroScreenByteParityAdapter } from "./types";

type RetroByteParityAdapterOptions = {
  rows: number;
  cols: number;
  scrollback?: number;
};

export const createRetroByteParityAdapter = ({
  rows,
  cols,
  scrollback
}: RetroByteParityAdapterOptions): RetroScreenByteParityAdapter => {
  const createBuffer = () =>
    new RetroScreenScreenBuffer({
      rows,
      cols,
      scrollback
    });

  let buffer = createBuffer();

  return {
    source: "retro-lcd",
    reset: () => {
      buffer = createBuffer();
    },
    write: (chunk: string) => {
      buffer.write(chunk);
    },
    snapshot: () => normalizeRetroScreenSnapshot(buffer.getSnapshot())
  };
};
