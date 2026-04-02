import type {
  RetroScreenByteParityMismatch,
  RetroScreenByteParityRunResult
} from "./types";

const escapePreview = (value: string) =>
  value
    .replace(/\\/gu, "\\\\")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n")
    .replace(/\t/gu, "\\t")
    .replace(/\u001b/gu, "\\u001b");

export const formatBytePreview = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

export const formatByteParityMismatch = (mismatch: RetroScreenByteParityMismatch) =>
  [
    `first divergence at byte offset ${mismatch.offset} (${mismatch.byteHex})`,
    `byte preview: ${JSON.stringify(escapePreview(mismatch.bytePreview))}`,
    ...mismatch.diffs
  ].join("\n");

export const formatByteParityReport = (result: RetroScreenByteParityRunResult) =>
  result.mismatch
    ? `${result.fixture.name} diverged after ${result.stepsMatched} matched bytes.\n${formatByteParityMismatch(
        result.mismatch
      )}\n\n${result.reproduction}`
    : `${result.fixture.name} matched for ${result.stepsMatched} byte steps.`;
