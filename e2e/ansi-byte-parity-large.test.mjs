import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import { runBrowserByteParityTrace } from "./support/ansi-byte-parity.mjs";
import { loadBadAppleAnsiByteFixture } from "./support/ansi-byte-parity-large-fixtures.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1100
  }
});

test("browser byte parity replays a substantial .ans file using sampled checkpoints with exact mismatch localization", async () => {
  const fixture = await loadBadAppleAnsiByteFixture({
    maxBytes: 262_144
  });

  await harness.gotoStory("retroscreen-internal--ansi-parity-harness");
  await harness.page.waitForSelector(".retro-screen");
  await harness.page.waitForTimeout(800);

  const mismatch = await runBrowserByteParityTrace({
    page: harness.page,
    fixture,
    sampling: {
      mode: "sample-after-warmup",
      warmupBytes: 128,
      sampleEvery: 32768,
      locateExactMismatch: true
    }
  });

  assert.equal(
    mismatch,
    null,
    mismatch
      ? `${fixture.name} diverged at byte ${mismatch.offset} (${String(mismatch.byte ?? "n/a")})\npreview=${mismatch.preview ?? "n/a"}\n${mismatch.diffs.join("\n")}`
      : undefined
  );
});
