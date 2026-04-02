import { describe, expect, it } from "vitest";
import { createHeadlessByteParityAdapter } from "./headless-byte-parity-adapter";
import { createRetroByteParityAdapter } from "./retro-byte-parity-adapter";
import { formatByteParityReport } from "./format-byte-parity-diff";
import {
  formatAnsiGalleryFailureContext,
  loadAnsiGalleryFixture,
  selectAnsiGalleryItemsByIds
} from "./fixtures/ansi-gallery-corpus";
import { promotedAnsiGalleryCorpus } from "./fixtures/ansi-parity-corpus";
import { runSampledByteParity } from "./run-sampled-byte-parity";

describe("real tty byte parity promoted ansi gallery corpus", () => {
  it("keeps promoted real ansi art fixtures green in the always-on sampled suite", async () => {
    for (const entry of promotedAnsiGalleryCorpus) {
      if (!("galleryAssetId" in entry)) {
        continue;
      }

      const [item] = await selectAnsiGalleryItemsByIds([entry.galleryAssetId]);
      const fixture = await loadAnsiGalleryFixture(item, {
        maxBytes: entry.maxBytes
      });
      const result = await runSampledByteParity({
        fixture,
        retroScreen: createRetroByteParityAdapter(fixture),
        reference: createHeadlessByteParityAdapter(fixture),
        sampling: {
          mode: "sample-after-warmup",
          warmupBytes: 64,
          sampleEvery: 32768,
          locateExactMismatch: true
        }
      });

      expect(
        result.mismatch,
        `${entry.id}\n${formatAnsiGalleryFailureContext({
          item,
          reproduction: result.reproduction
        })}\n${formatByteParityReport(result)}`
      ).toBeNull();
    }
  }, 120_000);
});
