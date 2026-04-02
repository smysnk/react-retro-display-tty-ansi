import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import {
  shellSessionTraceByteFixture,
  statusPaneTraceByteFixture
} from "./support/ansi-byte-parity-fixtures.mjs";
import { runBrowserByteParityTrace } from "./support/ansi-byte-parity.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1440,
    height: 1000
  }
});

const runTrace = async (fixture) => {
  await harness.gotoStory("retroscreen-internal--ansi-parity-harness");
  await harness.page.waitForSelector(".retro-screen");
  await harness.page.waitForTimeout(800);

  const mismatch = await runBrowserByteParityTrace({
    page: harness.page,
    fixture
  });

  assert.equal(
    mismatch,
    null,
    mismatch
      ? `${fixture.name} diverged at byte ${mismatch.offset} (${String(mismatch.byte ?? "n/a")})\npreview=${mismatch.preview ?? "n/a"}\n${mismatch.diffs.join("\n")}`
      : undefined
  );
};

test("browser byte parity keeps the shell session trace aligned with the reference terminal", async () => {
  await runTrace(shellSessionTraceByteFixture);
});

test("browser byte parity keeps the status pane trace aligned with the reference terminal", async () => {
  await runTrace(statusPaneTraceByteFixture);
});
