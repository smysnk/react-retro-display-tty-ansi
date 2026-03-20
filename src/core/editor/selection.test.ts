import { describe, expect, it } from "vitest";
import {
  collapseRetroLcdTextSelectionToEnd,
  collapseRetroLcdTextSelectionToStart,
  createRetroLcdTextSelection,
  deleteRetroLcdSelectedText,
  findRetroLcdNextWordBoundary,
  findRetroLcdPreviousWordBoundary,
  getRetroLcdWordSelectionAtOffset,
  isRetroLcdTextSelectionCollapsed,
  normalizeRetroLcdTextSelection,
  replaceRetroLcdSelectedText
} from "./selection";

describe("retro lcd text selection helpers", () => {
  it("normalizes reverse selections into ascending ranges", () => {
    expect(normalizeRetroLcdTextSelection({ start: 8, end: 3 }, 12)).toEqual({
      start: 3,
      end: 8
    });
  });

  it("clamps selections to the text length", () => {
    expect(createRetroLcdTextSelection(-5, 20, 7)).toEqual({
      start: 0,
      end: 7
    });
  });

  it("reports collapsed selections", () => {
    expect(isRetroLcdTextSelectionCollapsed({ start: 4, end: 4 })).toBe(true);
    expect(isRetroLcdTextSelectionCollapsed({ start: 4, end: 6 })).toBe(false);
  });

  it("collapses selections to their start and end offsets", () => {
    expect(collapseRetroLcdTextSelectionToStart({ start: 2, end: 5 })).toEqual({
      start: 2,
      end: 2
    });
    expect(collapseRetroLcdTextSelectionToEnd({ start: 2, end: 5 })).toEqual({
      start: 5,
      end: 5
    });
  });

  it("deletes the selected text and collapses the cursor to the deletion point", () => {
    expect(deleteRetroLcdSelectedText("retro display", { start: 6, end: 13 })).toEqual({
      value: "retro ",
      deletedText: "display",
      selection: {
        start: 6,
        end: 6
      }
    });
  });

  it("replaces the selected text and collapses the cursor after the replacement", () => {
    expect(replaceRetroLcdSelectedText("retro display", { start: 6, end: 13 }, "screen")).toEqual({
      value: "retro screen",
      deletedText: "display",
      selection: {
        start: 12,
        end: 12
      }
    });
  });

  it("finds word boundaries across punctuation and whitespace", () => {
    const value = "retro-display tty";

    expect(findRetroLcdPreviousWordBoundary(value, 15)).toBe(14);
    expect(findRetroLcdNextWordBoundary(value, 0)).toBe(5);
    expect(findRetroLcdNextWordBoundary(value, 5)).toBe(13);
  });

  it("selects the full word at an in-word offset", () => {
    expect(getRetroLcdWordSelectionAtOffset("retro display tty", 8)).toEqual({
      start: 6,
      end: 13
    });
  });

  it("resolves whitespace offsets to the adjacent word selection", () => {
    expect(getRetroLcdWordSelectionAtOffset("retro display tty", 5)).toEqual({
      start: 0,
      end: 5
    });
  });
});
