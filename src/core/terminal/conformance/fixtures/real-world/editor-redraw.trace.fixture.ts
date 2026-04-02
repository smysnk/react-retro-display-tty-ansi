import type { RetroScreenTerminalFixture } from "../../types";

export const editorRedrawTraceFixture: RetroScreenTerminalFixture = {
  name: "editor-redraw-trace",
  description:
    "A nano-like editor redraw trace with full-screen clears, line rewrites, inverse status text, and cursor repositioning should match xterm end state.",
  classification: "implemented",
  rows: 8,
  cols: 32,
  chunks: [
    "\u001b[2J\u001b[Hnotes.txt\r\n",
    "alpha\r\nbeta\r\ngamma",
    "\u001b[2;1H\u001b[2Kalpha revised",
    "\u001b[7;1H\u001b[7m^G Help ^O Write Out ^X Exit   \u001b[0m",
    "\u001b[3;5H"
  ],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [13, 131, 1313]
};
