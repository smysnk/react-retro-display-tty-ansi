import { describe, expect, it } from "vitest";
import { encodeRetroLcdTerminalInput } from "./input-encoder";

const createKeyEvent = (overrides: Partial<Parameters<typeof encodeRetroLcdTerminalInput>[0]>) => ({
  key: "",
  code: "",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  ...overrides
});

describe("encodeRetroLcdTerminalInput", () => {
  it("encodes printable keys directly", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "a",
          code: "KeyA"
        })
      )
    ).toBe("a");
  });

  it("encodes control-key combinations", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "c",
          code: "KeyC",
          ctrlKey: true
        })
      )
    ).toBe("\u0003");
  });

  it("encodes alt-printable input with an escape prefix", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "x",
          code: "KeyX",
          altKey: true
        })
      )
    ).toBe("\u001bx");
  });

  it("encodes cursor and paging keys with xterm-style sequences", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "ArrowUp",
          code: "ArrowUp"
        })
      )
    ).toBe("\u001b[A");
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "PageDown",
          code: "PageDown"
        })
      )
    ).toBe("\u001b[6~");
  });

  it("encodes modified navigation keys with CSI modifiers", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "ArrowRight",
          code: "ArrowRight",
          shiftKey: true,
          ctrlKey: true
        })
      )
    ).toBe("\u001b[1;6C");
  });

  it("switches cursor keys to SS3 sequences when application cursor mode is enabled", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "ArrowUp",
          code: "ArrowUp"
        }),
        {
          applicationCursorKeysMode: true
        }
      )
    ).toBe("\u001bOA");
  });

  it("leaves command/meta shortcuts alone by default", () => {
    expect(
      encodeRetroLcdTerminalInput(
        createKeyEvent({
          key: "k",
          code: "KeyK",
          metaKey: true
        })
      )
    ).toBeNull();
  });
});
