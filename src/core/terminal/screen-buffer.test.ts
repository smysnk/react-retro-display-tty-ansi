import { describe, expect, it } from "vitest";
import { RetroLcdScreenBuffer } from "./screen-buffer";

describe("RetroLcdScreenBuffer", () => {
  it("writes printable text and wraps to the next line", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4 });

    buffer.write("ABCDE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCD", "E"],
      cursor: {
        row: 1,
        col: 1
      }
    });
  });

  it("supports line feed without resetting the current column", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("AB\nZ");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["AB", "  Z", ""],
      cursor: {
        row: 1,
        col: 3
      }
    });
  });

  it("supports carriage return by returning to column zero", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB\rZ");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ZB", ""],
      cursor: {
        row: 0,
        col: 1
      }
    });
  });

  it("supports destructive backspace behavior", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB\bC");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["AC", ""],
      cursor: {
        row: 0,
        col: 2
      }
    });
  });

  it("expands tabs to the next tab stop", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 8, tabWidth: 4 });

    buffer.write("A\tB");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["A   B", ""],
      cursor: {
        row: 0,
        col: 5
      }
    });
  });

  it("scrolls upward when new content exceeds the visible rows", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4, scrollback: 4 });

    buffer.writeln("ONE");
    buffer.writeln("TWO");
    buffer.write("THREE");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["THRE", "E"],
      scrollback: ["ONE", "TWO"],
      cursor: {
        row: 1,
        col: 1
      }
    });
  });

  it("supports explicit cursor movement and cursor state updates", () => {
    const buffer = new RetroLcdScreenBuffer({
      rows: 2,
      cols: 5,
      cursorMode: "hollow"
    });

    buffer.moveCursorTo(1, 3);
    buffer.setCursorVisible(false);
    buffer.setCursorMode("solid");

    expect(buffer.getSnapshot().cursor).toEqual({
      row: 1,
      col: 3,
      visible: false,
      mode: "solid"
    });
  });

  it("supports CSI cursor movement and cursor positioning", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("ABCDEF");
    buffer.write("\u001b[1D");
    buffer.write("Z");
    buffer.write("\u001b[2;2H");
    buffer.write("Q");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABCDEF", "ZQ", ""],
      cursor: {
        row: 1,
        col: 2
      }
    });
  });

  it("supports erase line and erase display commands", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("HELLO");
    buffer.write("\u001b[1D");
    buffer.write("\u001b[K");
    buffer.write("\u001b[2;1H");
    buffer.write("WORLD");
    buffer.write("\u001b[1J");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", "", ""]
    });
  });

  it("supports save and restore cursor", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 3, cols: 6 });

    buffer.write("AB");
    buffer.write("\u001b[s");
    buffer.write("\u001b[3;3H");
    buffer.write("Z");
    buffer.write("\u001b[u");
    buffer.write("C");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ABC", "", "  Z"]
    });
  });

  it("tracks basic monochrome sgr styles per cell", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("\u001b[1mA");
    buffer.write("\u001b[2mB");
    buffer.write("\u001b[7mC");
    buffer.write("\u001b[8mD");
    buffer.write("\u001b[0mE");

    const snapshot = buffer.getSnapshot();
    expect(snapshot.cells[0][0].style).toMatchObject({
      intensity: "bold",
      inverse: false,
      conceal: false
    });
    expect(snapshot.cells[0][1].style).toMatchObject({
      intensity: "faint"
    });
    expect(snapshot.cells[0][2].style).toMatchObject({
      inverse: true
    });
    expect(snapshot.cells[0][3].style).toMatchObject({
      conceal: true
    });
    expect(snapshot.cells[0][4].style).toMatchObject({
      intensity: "normal",
      inverse: false,
      conceal: false
    });
  });

  it("preserves partial escape sequences across writes", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 6 });

    buffer.write("AB");
    buffer.write("\u001b[");
    buffer.write("2D");
    buffer.write("Z");

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["ZB", ""]
    });
  });

  it("clears and resets independently", () => {
    const buffer = new RetroLcdScreenBuffer({ rows: 2, cols: 4, cursorMode: "hollow" });

    buffer.write("ABCD");
    buffer.clear();

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", ""],
      cursor: {
        row: 0,
        col: 0,
        mode: "hollow",
        visible: true
      }
    });

    buffer.write("ZZ");
    buffer.reset();

    expect(buffer.getSnapshot()).toMatchObject({
      lines: ["", ""],
      scrollback: [],
      cursor: {
        row: 0,
        col: 0,
        mode: "solid",
        visible: true
      }
    });
  });
});
