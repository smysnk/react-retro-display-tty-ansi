import type {
  RetroScreenTerminalMouseProtocol,
  RetroScreenTerminalMouseTrackingMode
} from "./types";

const ESC = "\u001b";
const SHIFT_MODIFIER = 4;
const META_MODIFIER = 8;
const CTRL_MODIFIER = 16;
const MOTION_MODIFIER = 32;
const WHEEL_MODIFIER = 64;

export type RetroScreenTerminalMouseButton =
  | "left"
  | "middle"
  | "right"
  | "wheel-up"
  | "wheel-down"
  | "none";

export type RetroScreenTerminalMouseAction = "press" | "release" | "move" | "wheel";

export type RetroScreenTerminalMouseEvent = {
  action: RetroScreenTerminalMouseAction;
  button: RetroScreenTerminalMouseButton;
  row: number;
  col: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export type RetroScreenTerminalMouseEncodingOptions = {
  protocol?: RetroScreenTerminalMouseProtocol;
  trackingMode?: RetroScreenTerminalMouseTrackingMode;
};

const clampCoordinate = (value: number) =>
  Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1);

const getModifierBits = (event: RetroScreenTerminalMouseEvent) =>
  (event.shiftKey ? SHIFT_MODIFIER : 0) +
  (event.altKey || event.metaKey ? META_MODIFIER : 0) +
  (event.ctrlKey ? CTRL_MODIFIER : 0);

const getButtonCode = (
  button: RetroScreenTerminalMouseButton,
  action: RetroScreenTerminalMouseAction
) => {
  switch (button) {
    case "left":
      return 0;
    case "middle":
      return 1;
    case "right":
      return 2;
    case "none":
      return action === "move" ? 3 : null;
    case "wheel-up":
      return WHEEL_MODIFIER;
    case "wheel-down":
      return WHEEL_MODIFIER + 1;
    default:
      return null;
  }
};

const supportsMotion = (trackingMode: RetroScreenTerminalMouseTrackingMode) =>
  trackingMode === "drag" || trackingMode === "any";

const shouldEncodeEvent = (
  event: RetroScreenTerminalMouseEvent,
  trackingMode: RetroScreenTerminalMouseTrackingMode
) => {
  switch (event.action) {
    case "press":
    case "release":
      return trackingMode !== "none";
    case "wheel":
      return trackingMode !== "none";
    case "move":
      if (!supportsMotion(trackingMode)) {
        return false;
      }

      return trackingMode === "any" || event.button !== "none";
    default:
      return false;
  }
};

export const encodeRetroScreenTerminalMouse = (
  event: RetroScreenTerminalMouseEvent,
  options: RetroScreenTerminalMouseEncodingOptions = {}
): string | null => {
  const protocol = options.protocol ?? "none";
  const trackingMode = options.trackingMode ?? "none";

  if (protocol !== "sgr" || !shouldEncodeEvent(event, trackingMode)) {
    return null;
  }

  const buttonCode = getButtonCode(event.button, event.action);
  if (buttonCode === null) {
    return null;
  }

  const modifiers = getModifierBits(event);
  const motion = event.action === "move" ? MOTION_MODIFIER : 0;
  const encodedButton = buttonCode + modifiers + motion;
  const final =
    event.action === "release" && event.button !== "wheel-up" && event.button !== "wheel-down"
      ? "m"
      : "M";

  return `${ESC}[<${encodedButton};${clampCoordinate(event.col)};${clampCoordinate(event.row)}${final}`;
};
