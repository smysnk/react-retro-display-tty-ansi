import { describe, expect, it } from "vitest";
import {
  encodeRetroScreenTerminalFocusReport,
  encodeRetroScreenTerminalPaste
} from "./paste-encoder";

describe("encodeRetroScreenTerminalPaste", () => {
  it("returns raw pasted text by default", () => {
    expect(encodeRetroScreenTerminalPaste("line one\nline two")).toBe("line one\nline two");
  });

  it("wraps pasted text when bracketed paste mode is enabled", () => {
    expect(
      encodeRetroScreenTerminalPaste("status --watch", {
        bracketedPasteMode: true
      })
    ).toBe("\u001b[200~status --watch\u001b[201~");
  });
});

describe("encodeRetroScreenTerminalFocusReport", () => {
  it("encodes focus in and focus out reports", () => {
    expect(encodeRetroScreenTerminalFocusReport(true)).toBe("\u001b[I");
    expect(encodeRetroScreenTerminalFocusReport(false)).toBe("\u001b[O");
  });
});
