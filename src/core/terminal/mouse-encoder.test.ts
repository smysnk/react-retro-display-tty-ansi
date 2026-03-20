import { describe, expect, it } from "vitest";
import { encodeRetroLcdTerminalMouse } from "./mouse-encoder";

describe("encodeRetroLcdTerminalMouse", () => {
  it("encodes left-button press events in SGR mode", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "press",
          button: "left",
          row: 4,
          col: 10,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false
        },
        {
          protocol: "sgr",
          trackingMode: "vt200"
        }
      )
    ).toBe("\u001b[<0;10;4M");
  });

  it("encodes button releases with the SGR release final byte", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "release",
          button: "right",
          row: 7,
          col: 12,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: true
        },
        {
          protocol: "sgr",
          trackingMode: "vt200"
        }
      )
    ).toBe("\u001b[<6;12;7m");
  });

  it("encodes drag motion with the motion bit set", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "move",
          button: "left",
          row: 8,
          col: 14,
          altKey: false,
          ctrlKey: true,
          metaKey: false,
          shiftKey: false
        },
        {
          protocol: "sgr",
          trackingMode: "drag"
        }
      )
    ).toBe("\u001b[<48;14;8M");
  });

  it("encodes any-event motion even with no pressed button", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "move",
          button: "none",
          row: 2,
          col: 3,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false
        },
        {
          protocol: "sgr",
          trackingMode: "any"
        }
      )
    ).toBe("\u001b[<35;3;2M");
  });

  it("encodes wheel events while mouse reporting is active", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "wheel",
          button: "wheel-down",
          row: 5,
          col: 9,
          altKey: true,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false
        },
        {
          protocol: "sgr",
          trackingMode: "vt200"
        }
      )
    ).toBe("\u001b[<73;9;5M");
  });

  it("returns null when SGR mouse reporting is not active", () => {
    expect(
      encodeRetroLcdTerminalMouse(
        {
          action: "press",
          button: "left",
          row: 1,
          col: 1,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false
        },
        {
          protocol: "none",
          trackingMode: "vt200"
        }
      )
    ).toBeNull();
  });
});
