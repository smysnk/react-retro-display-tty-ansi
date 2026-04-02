import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1280,
    height: 900
  }
});

test("ansi parity harness story exposes byte-step reset, write, and snapshot methods", async () => {
  await harness.gotoStory("retroscreen-internal--ansi-parity-harness");
  await harness.page.waitForSelector(".retro-screen");
  await harness.page.waitForTimeout(800);

  const initialSnapshot = await harness.page.evaluate(() => window.__RETRO_SCREEN_ANSI_PARITY__?.snapshot() ?? null);

  assert.ok(initialSnapshot, "The parity harness should expose a snapshot API on window.");
  assert.equal(initialSnapshot.rows, 6);
  assert.equal(initialSnapshot.cols, 12);

  const snapshot = await harness.page.evaluate(async () => {
    const api = window.__RETRO_SCREEN_ANSI_PARITY__;

    if (!api) {
      return null;
    }

    await api.reset();
    await api.writeBytes([65, 66, 13, 90]);

    return api.snapshot();
  });

  assert.ok(snapshot, "The parity harness should return a terminal snapshot after byte playback.");
  assert.equal(snapshot.rawLines[0], "ZB".padEnd(12, " "));
  assert.equal(snapshot.cursor.row, 0);
  assert.equal(snapshot.cursor.col, 1);
});
