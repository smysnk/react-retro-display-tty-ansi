import { describe, expect, it } from "vitest";
import { encodeRetroScreenTerminalInput } from "./input-encoder";

const createKeyEvent = (overrides: Partial<Parameters<typeof encodeRetroScreenTerminalInput>[0]>) => ({
  key: "",
  code: "",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  ...overrides
});

describe("encodeRetroScreenTerminalInput", () => {
  it("encodes printable keys directly", () => {
    expect(
      encodeRetroScreenTerminalInput(
        createKeyEvent({
          key: "a",
          code: "KeyA"
        })
      )
    ).toBe("a");
  });

  it("encodes control-key combinations", () => {
    expect(
      encodeRetroScreenTerminalInput(
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
      encodeRetroScreenTerminalInput(
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
      encodeRetroScreenTerminalInput(
        createKeyEvent({
          key: "ArrowUp",
          code: "ArrowUp"
        })
      )
    ).toBe("\u001b[A");
    expect(
      encodeRetroScreenTerminalInput(
        createKeyEvent({
          key: "PageDown",
          code: "PageDown"
        })
      )
    ).toBe("\u001b[6~");
  });

  it("encodes modified navigation keys with CSI modifiers", () => {
    expect(
      encodeRetroScreenTerminalInput(
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
      encodeRetroScreenTerminalInput(
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
      encodeRetroScreenTerminalInput(
        createKeyEvent({
          key: "k",
          code: "KeyK",
          metaKey: true
        })
      )
    ).toBeNull();
  });
});
