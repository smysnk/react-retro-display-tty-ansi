import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import { runBrowserByteParityTrace } from "./support/ansi-byte-parity.mjs";
import { loadBadAppleAnsiByteFixture } from "./support/ansi-byte-parity-large-fixtures.mjs";
import {
  formatAnsiGalleryFailureContext,
  loadAnsiGalleryFixture,
  selectAnsiGalleryItemsByIds
} from "./support/ansi-gallery-fixtures.mjs";

const nightlyBrowserParity = process.env.ANSI_BROWSER_NIGHTLY_PARITY === "1" ? test : test.skip;

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1100
  }
});

const runExactFixture = async ({ fixture, failureContext }) => {
  await harness.gotoStory("retroscreen-internal--ansi-parity-harness");
  await harness.page.waitForSelector(".retro-screen");
  await harness.page.waitForTimeout(800);

  const mismatch = await runBrowserByteParityTrace({
    page: harness.page,
    fixture,
    sampling: {
      mode: "every-byte"
    }
  });

  assert.equal(
    mismatch,
    null,
    mismatch
      ? `${failureContext}\nbyte=${String(mismatch.byte ?? "n/a")} offset=${mismatch.offset}\npreview=${mismatch.preview ?? "n/a"}\n${mismatch.diffs.join("\n")}`
      : undefined
  );
};

nightlyBrowserParity(
  "browser nightly parity replays full canonical ansi assets byte by byte",
  async () => {
    const [agVeItem] = await selectAnsiGalleryItemsByIds(["101-ag-cansi-ag-ve-ans"]);

    await runExactFixture({
      fixture: await loadBadAppleAnsiByteFixture(),
      failureContext: "nightly browser parity: full BADAPPLE.ANS"
    });

    await runExactFixture({
      fixture: await loadAnsiGalleryFixture(agVeItem),
      failureContext: formatAnsiGalleryFailureContext({
        item: agVeItem,
        reproduction: "nightly browser parity: full AG-VE.ANS"
      })
    });
  },
  {
    timeout: 900_000
  }
);
