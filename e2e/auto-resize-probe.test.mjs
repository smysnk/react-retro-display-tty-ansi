import assert from "node:assert/strict";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";

const harness = createStorybookBrowserHarness();
const page = () => harness.page;

const readAutoResizeProbeState = async () =>
  page().locator(".sb-retro-auto-resize-frame").evaluate((frame) => {
    const root = frame.querySelector(".retro-lcd");
    const frameRect = frame.getBoundingClientRect();
    const lines = Array.from(root?.querySelectorAll(".retro-lcd__line") ?? []).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    );

    return {
      redrawSequence: Number(frame.getAttribute("data-probe-redraw-seq") ?? "0"),
      redrawReason: frame.getAttribute("data-probe-last-redraw-reason") ?? "",
      redrawRows: Number(frame.getAttribute("data-probe-last-redraw-rows") ?? "0"),
      redrawCols: Number(frame.getAttribute("data-probe-last-redraw-cols") ?? "0"),
      frameWidth: frameRect.width,
      frameHeight: frameRect.height,
      targetWidth: Number.parseFloat(frame.style.width || "0"),
      targetHeight: Number.parseFloat(frame.style.height || "0"),
      rows: Number(root?.getAttribute("data-rows") ?? "0"),
      cols: Number(root?.getAttribute("data-cols") ?? "0"),
      lines
    };
  });

const isBetween = (value, start, end) => {
  const lower = Math.min(start, end) + 0.5;
  const upper = Math.max(start, end) - 0.5;
  return value > lower && value < upper;
};

test("auto-resize probe snaps to a new stable geometry without cutting the rendered frame", async () => {
  await harness.gotoStory("retroscreen--auto-resize-probe");

  await page().waitForFunction(() => {
    const frame = document.querySelector(".sb-retro-auto-resize-frame");
    return Number(frame?.getAttribute("data-probe-redraw-seq") ?? "0") > 0;
  });

  const initialState = await readAutoResizeProbeState();

  await page().waitForFunction((startingWidth, startingHeight) => {
    const frame = document.querySelector(".sb-retro-auto-resize-frame");

    if (!(frame instanceof HTMLElement)) {
      return false;
    }

    const rect = frame.getBoundingClientRect();
    const targetWidth = Number.parseFloat(frame.style.width || "0");
    const targetHeight = Number.parseFloat(frame.style.height || "0");
    const widthIsAnimating =
      Math.abs(targetWidth - startingWidth) > 0.5 &&
      Math.abs(rect.width - startingWidth) > 0.5 &&
      Math.abs(rect.width - targetWidth) > 0.5;
    const heightIsAnimating =
      Math.abs(targetHeight - startingHeight) > 0.5 &&
      Math.abs(rect.height - startingHeight) > 0.5 &&
      Math.abs(rect.height - targetHeight) > 0.5;

    return widthIsAnimating || heightIsAnimating;
  }, initialState.frameWidth, initialState.frameHeight);

  const motionSamples = [];
  for (let index = 0; index < 3; index += 1) {
    motionSamples.push(await readAutoResizeProbeState());
    await page().waitForTimeout(120);
  }

  const firstMotionSample = motionSamples[0];
  const lastMotionSample = motionSamples.at(-1);
  const sawIntermediateWidth = motionSamples.some((sample) =>
    isBetween(sample.frameWidth, initialState.frameWidth, sample.targetWidth)
  );
  const sawIntermediateHeight = motionSamples.some((sample) =>
    isBetween(sample.frameHeight, initialState.frameHeight, sample.targetHeight)
  );
  const distinctMotionWidths = new Set(
    motionSamples.map((sample) => Math.round(sample.frameWidth * 100))
  ).size;
  const distinctMotionHeights = new Set(
    motionSamples.map((sample) => Math.round(sample.frameHeight * 100))
  ).size;
  const widthProgressed =
    firstMotionSample && lastMotionSample
      ? Math.abs(firstMotionSample.targetWidth - lastMotionSample.frameWidth) <
        Math.abs(firstMotionSample.targetWidth - firstMotionSample.frameWidth)
      : false;
  const heightProgressed =
    firstMotionSample && lastMotionSample
      ? Math.abs(firstMotionSample.targetHeight - lastMotionSample.frameHeight) <
        Math.abs(firstMotionSample.targetHeight - firstMotionSample.frameHeight)
      : false;

  assert.ok(
    sawIntermediateWidth || sawIntermediateHeight,
    "The resize should pass through an in-between measured size instead of jumping directly."
  );
  assert.ok(
    distinctMotionWidths > 1 || distinctMotionHeights > 1,
    "The resize should produce multiple distinct frame measurements while it animates."
  );
  assert.ok(
    widthProgressed || heightProgressed,
    "The measured frame should keep moving toward the new target size during the animation."
  );

  await page().waitForFunction((startingSequence, startingRows, startingCols) => {
    const frame = document.querySelector(".sb-retro-auto-resize-frame");
    const root = frame?.querySelector(".retro-lcd");

    if (!frame || !root) {
      return false;
    }

    return (
      Number(frame.getAttribute("data-probe-redraw-seq") ?? "0") > startingSequence &&
      (
        Number(root.getAttribute("data-rows") ?? "0") !== startingRows ||
        Number(root.getAttribute("data-cols") ?? "0") !== startingCols
      )
    );
  }, initialState.redrawSequence, initialState.rows, initialState.cols);

  const settledState = await readAutoResizeProbeState();

  assert.ok(
    settledState.redrawSequence > initialState.redrawSequence,
    "The probe should redraw again after the demo advances to the next size."
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
  assert.ok(
    settledState.lines.slice(1, -1).every((line) => line[0] !== " " && line.at(-1) !== " "),
    "The settled middle rows should preserve the side borders at both edges."
  );
});
