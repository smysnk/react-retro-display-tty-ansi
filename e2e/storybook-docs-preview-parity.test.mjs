import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1800
  }
});

const page = () => harness.page;

const docsUrl = (baseUrl) => {
  const url = new URL("/iframe.html", baseUrl);
  url.searchParams.set("id", "retroscreen--docs");
  url.searchParams.set("viewMode", "docs");
  return url;
};

const roundMetric = (value) => Math.round(value * 100) / 100;

const readStoryMetrics = (selector) =>
  page()
    .locator(selector)
    .evaluate((root) => {
      const queryRect = (target) => {
        if (!(target instanceof HTMLElement)) {
          return null;
        }

        const rect = target.getBoundingClientRect();

        return {
          width: rect.width,
          height: rect.height
        };
      };

      const queryStyle = (target) => {
        if (!(target instanceof HTMLElement)) {
          return null;
        }

        const style = getComputedStyle(target);

        return {
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          gap: style.gap,
          fontSize: style.fontSize
        };
      };

      const shell = root.querySelector(".sb-retro-shell");
      const stage = root.querySelector(".sb-retro-stage");
      const frame = root.querySelector(".sb-retro-frame");
      const screen = root.querySelector(".retro-screen");
      const grid = root.querySelector(".retro-screen__grid");

      return {
        page: queryStyle(root),
        shellRect: queryRect(shell),
        shellStyle: queryStyle(shell),
        stageRect: queryRect(stage),
        frameRect: queryRect(frame),
        screenRect: queryRect(screen),
        gridStyle: queryStyle(grid),
        screenDataset:
          screen instanceof HTMLElement
            ? {
                layoutStrategy: screen.dataset.layoutStrategy ?? "",
                gridMode: screen.dataset.gridMode ?? "",
                displayLayoutMode: screen.dataset.displayLayoutMode ?? "",
                displayFontSizingMode: screen.dataset.displayFontSizingMode ?? "",
                displayCharacterSizingMode: screen.dataset.displayCharacterSizingMode ?? ""
              }
            : null
      };
    })
    .then((metrics) =>
      JSON.parse(
        JSON.stringify(metrics, (_key, value) => (typeof value === "number" ? roundMetric(value) : value))
      )
    );

const readStandaloneMetrics = async (storyId) => {
  await harness.gotoStory(storyId);
  await page().waitForSelector(".sb-retro-page .sb-retro-shell", { timeout: 60_000 });
  return readStoryMetrics(".sb-retro-page");
};

const readDocsMetrics = async (docsStoryId) => {
  await page().goto(String(docsUrl(harness.baseUrl)), {
    waitUntil: "networkidle"
  });

  const storyRoot = page().locator(`[data-docs-story="${docsStoryId}"]`);
  await storyRoot.scrollIntoViewIfNeeded();
  await storyRoot.locator(".sb-retro-page .sb-retro-shell").waitFor({ timeout: 60_000 });

  return readStoryMetrics(`[data-docs-story="${docsStoryId}"] .sb-retro-page`);
};

const assertClose = (actual, expected, tolerance, label) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} should stay within ${tolerance}px. Received ${actual}, expected ${expected}.`
  );
};

test("docs previews keep canonical story geometry aligned with standalone story renders", async () => {
  const cases = [
    {
      docsStoryId: "calm-readout",
      storyId: "retroscreen--calm-readout"
    },
    {
      docsStoryId: "prompt-loop",
      storyId: "retroscreen--prompt-loop"
    }
  ];

  for (const entry of cases) {
    const standalone = await readStandaloneMetrics(entry.storyId);
    const docs = await readDocsMetrics(entry.docsStoryId);

    assert.equal(docs.page?.paddingLeft, standalone.page?.paddingLeft, `${entry.docsStoryId} should keep page left padding.`);
    assert.equal(docs.page?.paddingRight, standalone.page?.paddingRight, `${entry.docsStoryId} should keep page right padding.`);
    assert.equal(docs.shellStyle?.gap, standalone.shellStyle?.gap, `${entry.docsStoryId} should keep the same shell gap.`);
    assert.deepEqual(
      docs.screenDataset,
      standalone.screenDataset,
      `${entry.docsStoryId} should preserve the same RetroScreen layout settings in docs and standalone views.`
    );
    assert.equal(
      docs.gridStyle?.fontSize,
      standalone.gridStyle?.fontSize,
      `${entry.docsStoryId} should preserve the same grid font size.`
    );

    assertClose(docs.screenRect?.width ?? 0, standalone.screenRect?.width ?? 0, 2, `${entry.docsStoryId} screen width`);
    assertClose(docs.screenRect?.height ?? 0, standalone.screenRect?.height ?? 0, 2, `${entry.docsStoryId} screen height`);
  }
});
