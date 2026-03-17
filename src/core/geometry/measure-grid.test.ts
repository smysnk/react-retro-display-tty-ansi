import { describe, expect, it } from "vitest";
import { measureGrid } from "./measure-grid";

describe("measureGrid", () => {
  it("derives rows and columns using floor division", () => {
    expect(
      measureGrid({
        innerWidth: 103,
        innerHeight: 49,
        cellWidth: 10,
        cellHeight: 12
      })
    ).toMatchObject({
      cols: 10,
      rows: 4
    });
  });

  it("never returns less than one row or column", () => {
    expect(
      measureGrid({
        innerWidth: 0,
        innerHeight: 0,
        cellWidth: 12,
        cellHeight: 16
      })
    ).toMatchObject({
      cols: 1,
      rows: 1
    });
  });
});
