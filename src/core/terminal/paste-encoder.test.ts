import { describe, expect, it } from "vitest";
import {
  encodeRetroLcdTerminalFocusReport,
  encodeRetroLcdTerminalPaste
} from "./paste-encoder";

describe("encodeRetroLcdTerminalPaste", () => {
  it("returns raw pasted text by default", () => {
    expect(encodeRetroLcdTerminalPaste("line one\nline two")).toBe("line one\nline two");
  });

  it("wraps pasted text when bracketed paste mode is enabled", () => {
    expect(
      encodeRetroLcdTerminalPaste("status --watch", {
        bracketedPasteMode: true
      })
    ).toBe("\u001b[200~status --watch\u001b[201~");
  });
});

describe("encodeRetroLcdTerminalFocusReport", () => {
  it("encodes focus in and focus out reports", () => {
    expect(encodeRetroLcdTerminalFocusReport(true)).toBe("\u001b[I");
    expect(encodeRetroLcdTerminalFocusReport(false)).toBe("\u001b[O");
  });
});
