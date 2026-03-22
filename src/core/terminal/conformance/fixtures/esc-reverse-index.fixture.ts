import type { RetroScreenTerminalFixture } from "../types";

export const escReverseIndexFixture: RetroScreenTerminalFixture = {
  name: "esc-reverse-index",
  description: "ESC M should perform RI, moving upward and preserving the terminal state around pending wrap.",
  classification: "implemented",
  rows: 3,
  cols: 4,
  chunks: ["AB\nCD\u001bMZ"],
  chunkModes: ["fixture", "joined", "byte"]
};
