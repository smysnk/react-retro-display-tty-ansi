import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readAutoResizeProbeState = async () =>
  page().locator(".sb-retro-auto-resize-host").evaluate((host) => {
    const root = host.querySelector(".retro-lcd");
    const rootRect = root?.getBoundingClientRect();
    const stage = host.parentElement;
    const cursor = stage?.querySelector('[data-demo-cursor="true"]');
    const lines = Array.from(root?.querySelectorAll(".retro-lcd__line") ?? []).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    );

    return {
      redrawSequence: Number(host.getAttribute("data-probe-redraw-seq") ?? "0"),
      redrawReason: host.getAttribute("data-probe-last-redraw-reason") ?? "",
      redrawRows: Number(host.getAttribute("data-probe-last-redraw-rows") ?? "0"),
      redrawCols: Number(host.getAttribute("data-probe-last-redraw-cols") ?? "0"),
      rootWidth: rootRect?.width ?? 0,
      rootHeight: rootRect?.height ?? 0,
      rows: Number(root?.getAttribute("data-rows") ?? "0"),
      cols: Number(root?.getAttribute("data-cols") ?? "0"),
      lines,
      cursorVisible:
        cursor instanceof HTMLElement ? Number(getComputedStyle(cursor).opacity) > 0.9 : false,
      cursorRole: cursor?.getAttribute("data-demo-cursor-role") ?? "",
      cursorDragging: cursor?.getAttribute("data-demo-cursor-dragging") ?? "",
      demoState: stage?.getAttribute("data-demo-resize-state") ?? ""
    };
  });

test("auto-resize probe uses a visible scripted cursor to live-resize the panel without cutting the rendered frame", async () => {
  await harness.gotoStory("retroscreen--auto-resize-probe");

  await page().waitForFunction(() => {
    const host = document.querySelector(".sb-retro-auto-resize-host");
    const cursor = document.querySelector('[data-demo-cursor="true"]');
    return (
      Number(host?.getAttribute("data-probe-redraw-seq") ?? "0") > 0 &&
      cursor instanceof HTMLElement &&
      Number(getComputedStyle(cursor).opacity) > 0.9
    );
  }, { timeout: 10000 });

  const initialState = await readAutoResizeProbeState();

  assert.equal(initialState.demoState, "auto");
  assert.ok(initialState.cursorVisible, "The demo should show a visible cursor overlay.");
  await page().waitForTimeout(2200);

  const motionState = await readAutoResizeProbeState();

  assert.ok(
    Math.abs(motionState.rootWidth - initialState.rootWidth) > 28 ||
      Math.abs(motionState.rootHeight - initialState.rootHeight) > 28,
    "The live probe should visibly resize the panel."
  );

  await page().waitForTimeout(1400);

  const settledState = await readAutoResizeProbeState();

  assert.ok(
    settledState.redrawSequence > initialState.redrawSequence,
    "The probe should redraw again after a scripted resize completes."
  );
  assert.equal(
    settledState.redrawRows,
    settledState.rows,
    "The redraw should use the same row count the component reports."
  );
  assert.equal(
    settledState.redrawCols,
    settledState.cols,
    "The redraw should use the same column count the component reports."
  );
  assert.equal(
    settledState.lines.length,
    settledState.rows,
    "The settled frame should render one visible line for every measured row."
  );
  assert.ok(
    settledState.lines.every((line) => line.length === settledState.cols),
    "Every settled line should span the full reported column count."
  );
  assert.ok(
    settledState.lines[0]?.[0] && settledState.lines[0]?.at(-1),
    "The settled top border should reach both edges of the screen."
  );
  assert.ok(
    settledState.lines.at(-1)?.[0] && settledState.lines.at(-1)?.at(-1),
    "The settled bottom border should reach both edges of the screen."
  );
});
