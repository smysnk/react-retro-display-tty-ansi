import { describe, expect, it } from "vitest";
import {
  collapseRetroScreenTextSelectionToEnd,
  collapseRetroScreenTextSelectionToStart,
  createRetroScreenTextSelection,
  deleteRetroScreenSelectedText,
  findRetroScreenNextWordBoundary,
  findRetroScreenPreviousWordBoundary,
  getRetroScreenWordSelectionAtOffset,
  isRetroScreenTextSelectionCollapsed,
  normalizeRetroScreenTextSelection,
  replaceRetroScreenSelectedText
} from "./selection";

describe("retro lcd text selection helpers", () => {
  it("normalizes reverse selections into ascending ranges", () => {
    expect(normalizeRetroScreenTextSelection({ start: 8, end: 3 }, 12)).toEqual({
      start: 3,
      end: 8
    });
  });

  it("clamps selections to the text length", () => {
    expect(createRetroScreenTextSelection(-5, 20, 7)).toEqual({
      start: 0,
      end: 7
    });
  });

  it("reports collapsed selections", () => {
    expect(isRetroScreenTextSelectionCollapsed({ start: 4, end: 4 })).toBe(true);
    expect(isRetroScreenTextSelectionCollapsed({ start: 4, end: 6 })).toBe(false);
  });

  it("collapses selections to their start and end offsets", () => {
    expect(collapseRetroScreenTextSelectionToStart({ start: 2, end: 5 })).toEqual({
      start: 2,
      end: 2
    });
    expect(collapseRetroScreenTextSelectionToEnd({ start: 2, end: 5 })).toEqual({
      start: 5,
      end: 5
    });
  });

  it("deletes the selected text and collapses the cursor to the deletion point", () => {
    expect(deleteRetroScreenSelectedText("retro display", { start: 6, end: 13 })).toEqual({
      value: "retro ",
      deletedText: "display",
      selection: {
        start: 6,
        end: 6
      }
    });
  });

  it("replaces the selected text and collapses the cursor after the replacement", () => {
    expect(replaceRetroScreenSelectedText("retro display", { start: 6, end: 13 }, "screen")).toEqual({
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

    expect(findRetroScreenPreviousWordBoundary(value, 15)).toBe(14);
    expect(findRetroScreenNextWordBoundary(value, 0)).toBe(5);
    expect(findRetroScreenNextWordBoundary(value, 5)).toBe(13);
  });

  it("selects the full word at an in-word offset", () => {
    expect(getRetroScreenWordSelectionAtOffset("retro display tty", 8)).toEqual({
      start: 6,
      end: 13
    });
  });

  it("resolves whitespace offsets to the adjacent word selection", () => {
    expect(getRetroScreenWordSelectionAtOffset("retro display tty", 5)).toEqual({
      start: 0,
      end: 5
    });
  });
});
