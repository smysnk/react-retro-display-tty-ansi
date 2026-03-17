import { describe, expect, it, vi } from "vitest";
import { RetroLcdAnsiParser } from "./ansi-parser";

const createHandlers = () => ({
  printable: vi.fn(),
  lineFeed: vi.fn(),
  carriageReturn: vi.fn(),
  backspace: vi.fn(),
  tab: vi.fn(),
  formFeed: vi.fn(),
  bell: vi.fn(),
  cursorUp: vi.fn(),
  cursorDown: vi.fn(),
  cursorForward: vi.fn(),
  cursorBackward: vi.fn(),
  cursorPosition: vi.fn(),
  eraseInDisplay: vi.fn(),
  eraseInLine: vi.fn(),
  saveCursor: vi.fn(),
  restoreCursor: vi.fn(),
  setGraphicRendition: vi.fn()
});

describe("RetroLcdAnsiParser", () => {
  it("routes essential control characters", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\n\r\b\t\f\u0007");

    expect(handlers.lineFeed).toHaveBeenCalledTimes(1);
    expect(handlers.carriageReturn).toHaveBeenCalledTimes(1);
    expect(handlers.backspace).toHaveBeenCalledTimes(1);
    expect(handlers.tab).toHaveBeenCalledTimes(1);
    expect(handlers.formFeed).toHaveBeenCalledTimes(1);
    expect(handlers.bell).toHaveBeenCalledTimes(1);
  });

  it("dispatches cursor movement CSI sequences", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[3A\u001b[4B\u001b[5C\u001b[6D\u001b[7;8H");

    expect(handlers.cursorUp).toHaveBeenCalledWith(3);
    expect(handlers.cursorDown).toHaveBeenCalledWith(4);
    expect(handlers.cursorForward).toHaveBeenCalledWith(5);
    expect(handlers.cursorBackward).toHaveBeenCalledWith(6);
    expect(handlers.cursorPosition).toHaveBeenCalledWith(7, 8);
  });

  it("dispatches erase, save/restore, and sgr sequences", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[2J\u001b[1K\u001b[s\u001b[u\u001b[1;7;8m");

    expect(handlers.eraseInDisplay).toHaveBeenCalledWith(2);
    expect(handlers.eraseInLine).toHaveBeenCalledWith(1);
    expect(handlers.saveCursor).toHaveBeenCalledTimes(1);
    expect(handlers.restoreCursor).toHaveBeenCalledTimes(1);
    expect(handlers.setGraphicRendition).toHaveBeenCalledWith([1, 7, 8]);
  });

  it("keeps partial escape sequences across multiple writes", () => {
    const handlers = createHandlers();
    const parser = new RetroLcdAnsiParser(handlers);

    parser.feed("\u001b[");
    parser.feed("2J");

    expect(handlers.eraseInDisplay).toHaveBeenCalledWith(2);
  });
});
