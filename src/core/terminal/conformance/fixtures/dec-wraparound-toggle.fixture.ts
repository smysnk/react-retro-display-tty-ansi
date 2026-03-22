import type { RetroScreenTerminalFixture } from "../types";

export const decWraparoundToggleFixture: RetroScreenTerminalFixture = {
  name: "dec-wraparound-toggle",
  description: "DEC private mode ?7 should preserve the private marker and disable autowrap when reset.",
  classification: "implemented",
  rows: 2,
  cols: 4,
  chunks: ["\u001b[?7lABCDE"],
  chunkModes: ["fixture", "joined", "byte"]
};
