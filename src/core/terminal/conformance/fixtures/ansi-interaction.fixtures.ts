import type { RetroScreenTerminalFixture } from "../types";

export const originModeCursorPositionFixture: RetroScreenTerminalFixture = {
  name: "origin-mode-cursor-position",
  description:
    "Origin mode should remap CSI H/f cursor addressing into the active scroll region until the mode is reset.",
  classification: "implemented",
  rows: 6,
  cols: 8,
  chunks: ["\u001b[2;5r", "\u001b[?6h", "\u001b[3;4HORG", "\u001b[2;2fX", "\u001b[?6l\u001b[1;1H!"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [17, 117]
};

export const scrollRegionIndexingFixture: RetroScreenTerminalFixture = {
  name: "scroll-region-indexing",
  description:
    "IND, NEL, and RI should interact correctly with the active scroll region instead of the full screen.",
  classification: "implemented",
  rows: 6,
  cols: 8,
  chunks: ["1\r\n2\r\n3\r\n4", "\u001b[2;4r", "\u001b[4;1H\u001bD", "\u001b[2;1H\u001bM", "\u001b[3;4H\u001bE!"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [23, 223]
};

export const insertDeleteInteractionFixture: RetroScreenTerminalFixture = {
  name: "insert-delete-interaction",
  description:
    "Insert mode, printable writes, and delete-chars should compose without leaving stale row content behind.",
  classification: "implemented",
  rows: 3,
  cols: 8,
  chunks: ["ABCDE", "\u001b[4D\u001b[4hZ", "\u001b[P\u001b[4lY"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [29, 229]
};

export const wraparoundFinalColumnInteractionFixture: RetroScreenTerminalFixture = {
  name: "wraparound-final-column-interaction",
  description:
    "Writes at the final column should honor wraparound on/off transitions without drifting the cursor.",
  classification: "implemented",
  rows: 3,
  cols: 4,
  chunks: ["ABCD", "E", "\u001b[?7lWXYZQ", "\u001b[?7h\r\n1234", "5"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [31, 331]
};

export const saveRestoreEraseScrollFixture: RetroScreenTerminalFixture = {
  name: "save-restore-erase-scroll",
  description:
    "Saved cursor state should survive line erases and bottom-row scrolling before restore is applied.",
  classification: "implemented",
  rows: 2,
  cols: 6,
  chunks: ["ROW1\r\nROW2", "\u001b[s", "\u001b[2;2H\u001b[K", "\r\nNEXT", "\u001b[uZ"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [37, 337]
};

export const styledEraseInteractionFixture: RetroScreenTerminalFixture = {
  name: "styled-erase-interaction",
  description:
    "Erase commands should leave blank cells behind while preserving the active styling semantics.",
  classification: "implemented",
  rows: 2,
  cols: 8,
  chunks: [
    "\u001b[31;44mREDROW",
    "\u001b[1;3H\u001b[2K",
    "\u001b[2;1H\u001b[32mGREEN",
    "\u001b[2;4H\u001b[J"
  ],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [41, 401]
};

export const alternateScreenRestoreFixture: RetroScreenTerminalFixture = {
  name: "alternate-screen-restore",
  description:
    "Alternate-screen entry and exit should preserve the primary buffer contents and restore visible state cleanly.",
  classification: "implemented",
  rows: 3,
  cols: 8,
  chunks: ["main\r\nshell", "\u001b[?1049hALT\r\nBUF", "\u001b[?1049l", "\r\nback"],
  chunkModes: ["fixture", "joined", "byte"],
  randomChunkSeeds: [43, 403]
};

export const ansiInteractionFixtures = [
  originModeCursorPositionFixture,
  scrollRegionIndexingFixture,
  insertDeleteInteractionFixture,
  wraparoundFinalColumnInteractionFixture,
  saveRestoreEraseScrollFixture,
  styledEraseInteractionFixture,
  alternateScreenRestoreFixture
] satisfies RetroScreenTerminalFixture[];
