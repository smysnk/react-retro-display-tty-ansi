import { describe, expect, it } from "vitest";
import { wrapTextToColumns } from "./wrap";

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
});
