import { ansi16ColorsFixture } from "./ansi-16-colors.fixture";
import {
  ansiSaveRestoreFixture,
  carriageReturnFixture,
  cursorHorizontalAbsoluteFixture,
  eraseCharsFixture,
  eraseInDisplayFixture,
  eraseInLineFixture,
  sgrAttributesFixture
} from "./ansi-command-matrix.fixtures";
import {
  formFeedLineAdvanceFixture,
  insertDeleteInteractionFixture,
  styledEraseInteractionFixture,
  wraparoundFinalColumnInteractionFixture
} from "./ansi-interaction.fixtures";
import { decSaveRestoreFixture } from "./dec-save-restore.fixture";
import { deleteCharsFixture } from "./delete-chars.fixture";
import { deleteLinesFixture } from "./delete-lines.fixture";
import { indexed256ColorsFixture } from "./indexed-256-colors.fixture";
import { insertCharsFixture } from "./insert-chars.fixture";
import { insertLinesFixture } from "./insert-lines.fixture";
import { pendingWrapLastColumnFixture } from "./pending-wrap-last-column.fixture";
import { scrollRegionShiftFixture } from "./scroll-region-shift.fixture";
import { truecolorFixture } from "./truecolor.fixture";
import type { RetroScreenByteParityFixture, RetroScreenTerminalFixture } from "../types";

type RetroScreenAnsiParityCorpusSourceType =
  | "handcrafted"
  | "captured-trace"
  | "ansi-art"
  | "animation";

type RetroScreenAnsiParityCorpusTier = "pr-ci" | "scheduled-ci" | "local-opt-in";

export type RetroScreenAnsiParityCorpusEntry = {
  id: string;
  sourceType: RetroScreenAnsiParityCorpusSourceType;
  tier: RetroScreenAnsiParityCorpusTier;
  stresses: string[];
} & (
  | {
      fixture: RetroScreenByteParityFixture;
    }
  | {
      galleryAssetId: string;
      maxBytes?: number;
    }
);

const chunksToBytes = (chunks: readonly string[]) =>
  new Uint8Array(
    Array.from(chunks.join(""), (char) => {
      const code = char.charCodeAt(0);
      return code & 0xff;
    })
  );

export const terminalFixtureToByteParityFixture = (
  fixture: RetroScreenTerminalFixture
): RetroScreenByteParityFixture => ({
  name: fixture.name,
  description: fixture.description,
  rows: fixture.rows,
  cols: fixture.cols,
  scrollback: fixture.scrollback,
  bytes: chunksToBytes(fixture.chunks)
});

const defineEntry = (
  id: string,
  fixture: RetroScreenTerminalFixture,
  stresses: string[],
  tier: RetroScreenAnsiParityCorpusTier = "pr-ci"
): RetroScreenAnsiParityCorpusEntry => ({
  id,
  fixture: terminalFixtureToByteParityFixture(fixture),
  sourceType: "handcrafted",
  tier,
  stresses
});

export const byteParityPhase2Corpus = [
  defineEntry("cr-rewrite", carriageReturnFixture, ["carriage-return", "in-place-overwrite"]),
  defineEntry("erase-in-line", eraseInLineFixture, ["erase", "row-tail-cleanup"]),
  defineEntry("erase-in-display", eraseInDisplayFixture, ["erase", "full-viewport-clear"]),
  defineEntry("erase-chars", eraseCharsFixture, ["erase", "in-place-character-erasure"]),
  defineEntry("pending-wrap", pendingWrapLastColumnFixture, ["wrap", "final-column-pending-wrap"]),
  defineEntry("scroll-region-shift", scrollRegionShiftFixture, ["scroll", "scroll-region"]),
  defineEntry("ansi-save-restore", ansiSaveRestoreFixture, ["save-restore", "cursor-state"]),
  defineEntry("dec-save-restore", decSaveRestoreFixture, ["save-restore", "escape-sequences"]),
  defineEntry("insert-chars", insertCharsFixture, ["insert", "row-shift-right"]),
  defineEntry("delete-chars", deleteCharsFixture, ["delete", "row-pull-left"]),
  defineEntry("insert-lines", insertLinesFixture, ["insert", "scroll-region-lines"]),
  defineEntry("delete-lines", deleteLinesFixture, ["delete", "scroll-region-lines"]),
  defineEntry("sgr-attributes", sgrAttributesFixture, ["sgr", "attributes"]),
  defineEntry("ansi-16-colors", ansi16ColorsFixture, ["sgr", "palette-colors"]),
  defineEntry("indexed-256-colors", indexed256ColorsFixture, ["sgr", "indexed-colors"]),
  defineEntry("truecolor", truecolorFixture, ["sgr", "truecolor"]),
  defineEntry("cha", cursorHorizontalAbsoluteFixture, ["cursor-addressing", "absolute-column"]),
  defineEntry("styled-erase", styledEraseInteractionFixture, ["erase", "styled-blanks", "interaction"]),
  defineEntry("insert-delete-interaction", insertDeleteInteractionFixture, ["insert", "delete", "interaction"]),
  defineEntry("form-feed-line-advance", formFeedLineAdvanceFixture, ["control", "form-feed", "line-feed-like"]),
  defineEntry("wraparound-toggle", wraparoundFinalColumnInteractionFixture, ["wrap", "mode-interaction"])
] satisfies RetroScreenAnsiParityCorpusEntry[];

export const promotedAnsiGalleryCorpus = [
  {
    id: "gallery-ag-ve",
    galleryAssetId: "101-ag-cansi-ag-ve-ans",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file"],
    maxBytes: 131_072
  },
  {
    id: "gallery-hopar",
    galleryAssetId: "076-clear2ooo-ascii-year-lf-hopar",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "form-feed", "sauce-tail"]
  },
  {
    id: "gallery-drago",
    galleryAssetId: "195-azp0295-dg-drago-ans",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "save-restore", "cp437"]
  },
  {
    id: "gallery-upcore02",
    galleryAssetId: "200-upcore02-upcore02",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "color-cycling", "redraw"]
  },
  {
    id: "gallery-us-trek",
    galleryAssetId: "199-mimic73-us-trek",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "palette-sgr", "dense-redraw"]
  },
  {
    id: "gallery-mno3acd2",
    galleryAssetId: "182-acdu1192-mno3acd2-ans",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "control-bytes", "ansi-art"]
  },
  {
    id: "gallery-space-invaders",
    galleryAssetId: "178-blocktronics-space-invaders-we-meetspaceinvaders",
    sourceType: "ansi-art",
    tier: "pr-ci",
    stresses: ["real-ansi-art", "80x25", "full-file", "modern-gallery", "ansi-art"]
  }
] satisfies RetroScreenAnsiParityCorpusEntry[];
