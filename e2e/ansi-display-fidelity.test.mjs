import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1500,
    height: 1100
  }
});

const page = () => harness.page;

const readTerminalSnapshot = async () =>
  page().locator(".retro-screen").evaluate((root) => ({
    rows: Number(root.getAttribute("data-rows") ?? "0"),
    cols: Number(root.getAttribute("data-cols") ?? "0"),
    lines: Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    )
  }));

const waitForTerminalText = async (fragment, { timeout = 30000 } = {}) => {
  await page().waitForFunction(
    (expected) =>
      (document.querySelector(".retro-screen__body")?.textContent ?? "")
        .replace(/\u00a0/gu, " ")
        .includes(expected),
    fragment,
    { timeout }
  );
};

test("control character replay clears stale progress text after carriage-return rewrites", async () => {
  await harness.gotoStory("retroscreen-display-buffer--control-character-replay");

  await waitForTerminalText("Downloaded fixtures.");
  await waitForTerminalText("Ready.");

  const snapshot = await readTerminalSnapshot();
  const visibleText = snapshot.lines.join("\n");

  assert.ok(snapshot.cols >= 34, "The replay should preserve enough width for the fixture text.");
  assert.ok(snapshot.rows >= 4, "The replay should keep enough visible rows for the full trace.");
  assert.match(visibleText, /Downloaded fixtures\./u);
  assert.match(visibleText, /Ready\./u);
  assert.doesNotMatch(
    visibleText,
    /(12%|73%|100%)/u,
    "The final progress replay should not leave stale percentage fragments behind."
  );
});

test("control character replay keeps the wrapped shell trace readable after ANSI redraws", async () => {
  await harness.gotoStory("retroscreen-display-buffer--control-character-replay");
  await page().getByRole("button", { name: "Shell trace" }).click();

  await waitForTerminalText("random chunk parity");

  const snapshot = await readTerminalSnapshot();
  const visibleGridText = snapshot.lines.join("");

  assert.ok(snapshot.cols >= 32, "The wrapped trace should preserve enough width for the prompt.");
  assert.ok(snapshot.rows >= 5, "The wrapped trace should keep a multi-line viewport.");
  assert.ok(
    snapshot.lines.some((line) => line.includes("operator@retro")),
    "The wrapped shell trace should keep the prompt visible."
  );
  assert.ok(
    visibleGridText.includes("react-retro-display"),
    "The wrapped path segment should remain visible after replay."
  );
  assert.ok(
    snapshot.lines.some((line) => /PASS/u.test(line) && /random chunk parity/u.test(line)),
    "The final PASS line should render as a stable visible line."
  );
});

test("control character replay preserves the fixed header and inserted footer in the status pane trace", async () => {
  await harness.gotoStory("retroscreen-display-buffer--control-character-replay");
  await page().getByRole("button", { name: "Status pane" }).click();

  await waitForTerminalText("recorded regression fixture");

  const snapshot = await readTerminalSnapshot();

  assert.ok(snapshot.cols >= 28, "The status pane should preserve enough width for the footer.");
  assert.ok(snapshot.rows >= 5, "The status pane should keep the fixed header and footer visible.");
  assert.ok(
    snapshot.lines[0]?.includes("SESSION conformance"),
    "The status pane header should stay pinned at the top row."
  );
  assert.ok(
    snapshot.lines.some((line) => line.includes("oracle ready")),
    "The body content should remain visible inside the scroll region."
  );
  assert.ok(
    snapshot.lines.some((line) => line.includes("palette mapper ready")),
    "The lower scroll-region content should survive the insert-line update."
  );
  assert.ok(
    snapshot.lines.some((line) => line.includes("recorded regression fixture")),
    "The inserted footer line should be visible after replay."
  );
});

test("display color modes story keeps indexed and truecolor ANSI styling in the browser surface", async () => {
  await harness.gotoStory("retroscreen--display-color-modes");

  await page().waitForSelector('[data-display-mode-card="ansi-extended"] .retro-screen');

  const ansiExtendedMetrics = await page()
    .locator('[data-display-mode-card="ansi-extended"] .retro-screen')
    .evaluate((root) => {
      const rows = Array.from(root.querySelectorAll(".retro-screen__line"));
      const firstLineCells = rows[0]?.querySelectorAll(".retro-screen__cell") ?? [];
      const secondLineCells = rows[1]?.querySelectorAll(".retro-screen__cell") ?? [];
      const indexedCell = firstLineCells[0];
      const truecolorCell = secondLineCells[0];

      return {
        indexedColor:
          indexedCell instanceof HTMLElement ? getComputedStyle(indexedCell).color : "missing",
        indexedBackground:
          indexedCell instanceof HTMLElement
            ? getComputedStyle(indexedCell).backgroundColor
            : "missing",
        truecolorColor:
          truecolorCell instanceof HTMLElement ? getComputedStyle(truecolorCell).color : "missing",
        truecolorBackground:
          truecolorCell instanceof HTMLElement
            ? getComputedStyle(truecolorCell).backgroundColor
            : "missing"
      };
    });

  assert.deepEqual(ansiExtendedMetrics, {
    indexedColor: "rgb(255, 0, 0)",
    indexedBackground: "rgb(0, 95, 175)",
    truecolorColor: "rgb(17, 34, 51)",
    truecolorBackground: "rgb(68, 85, 102)"
  });
});
