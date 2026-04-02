import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import { runBrowserByteParityTrace } from "./support/ansi-byte-parity.mjs";
import {
  formatAnsiGalleryFailureContext,
  loadAnsiGalleryFixture,
  selectAnsiGalleryItemsByIds
} from "./support/ansi-gallery-fixtures.mjs";

const runBrowserGalleryParity =
  process.env.ANSI_GALLERY_BROWSER_PARITY === "1" ? test : test.skip;

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1100
  }
});

const galleryIds = (process.env.ANSI_GALLERY_BROWSER_IDS ?? "101-ag-cansi-ag-ve-ans")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const galleryMaxBytes = Number.parseInt(process.env.ANSI_GALLERY_BROWSER_MAX_BYTES ?? "", 10);
const gallerySampleEvery = Number.parseInt(process.env.ANSI_GALLERY_BROWSER_SAMPLE_EVERY ?? "", 10);

runBrowserGalleryParity(
  "browser byte parity replays the scheduled ansi-gallery browser corpus",
  async () => {
    const items = await selectAnsiGalleryItemsByIds(galleryIds);

    await harness.gotoStory("retroscreen-internal--ansi-parity-harness");
    await harness.page.waitForSelector(".retro-screen");
    await harness.page.waitForTimeout(800);

    for (const item of items) {
      const fixture = await loadAnsiGalleryFixture(item, {
        maxBytes: Number.isFinite(galleryMaxBytes) && galleryMaxBytes > 0 ? galleryMaxBytes : undefined
      });
      const mismatch = await runBrowserByteParityTrace({
        page: harness.page,
        fixture,
        sampling: {
          mode: "sample-after-warmup",
          warmupBytes: 64,
          sampleEvery:
            Number.isFinite(gallerySampleEvery) && gallerySampleEvery > 0 ? gallerySampleEvery : 65536,
          locateExactMismatch: true
        }
      });

      assert.equal(
        mismatch,
        null,
        mismatch
          ? `${formatAnsiGalleryFailureContext({
              item,
              reproduction: `browser gallery parity: ids=${galleryIds.join(",")}`
            })}\nbyte=${String(mismatch.byte ?? "n/a")} offset=${mismatch.offset}\npreview=${mismatch.preview ?? "n/a"}\n${mismatch.diffs.join("\n")}`
          : undefined
      );
    }
  },
  {
    timeout: 300_000
  }
);
