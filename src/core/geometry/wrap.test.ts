import { describe, expect, it } from "vitest";
import { wrapTextToCellRows, wrapTextToColumns } from "./wrap";

describe("wrapTextToColumns", () => {
  it("wraps long text at the configured width", () => {
    expect(wrapTextToColumns("ABCDEFGHIJ", { cols: 4 })).toEqual(["ABCD", "EFGH", "IJ"]);
  });

  it("preserves explicit line breaks", () => {
    expect(wrapTextToColumns("AB\nCD", { cols: 8 })).toEqual(["AB", "CD"]);
  });

  it("supports carriage return by restarting the current line", () => {
    expect(wrapTextToColumns("AB\rZ", { cols: 8 })).toEqual(["Z"]);
  });

  it("expands tabs to the next tab stop", () => {
    expect(wrapTextToColumns("A\tB", { cols: 8, tabWidth: 4 })).toEqual(["A   B"]);
  });

  it("retains blank lines introduced by explicit newlines", () => {
    expect(wrapTextToColumns("A\n\nB", { cols: 8 })).toEqual(["A", "", "B"]);
  });

  it("retains source offsets across wrapped rows", () => {
    expect(wrapTextToCellRows("ABCDE", { cols: 3 })).toEqual([
      [
        { char: "A", sourceOffset: 0 },
        { char: "B", sourceOffset: 1 },
        { char: "C", sourceOffset: 2 }
      ],
      [
        { char: "D", sourceOffset: 3 },
        { char: "E", sourceOffset: 4 }
      ]
    ]);
  });

  it("assigns tab-expanded cells back to the original tab offset", () => {
    expect(wrapTextToCellRows("A\tB", { cols: 8, tabWidth: 4 })).toEqual([
      [
        { char: "A", sourceOffset: 0 },
        { char: " ", sourceOffset: 1 },
        { char: " ", sourceOffset: 1 },
        { char: " ", sourceOffset: 1 },
        { char: "B", sourceOffset: 2 }
      ]
    ]);
  });
});
