import type { RetroScreenByteParityFixture } from "../types";

const bytesFromLatin1 = (value: string) => new Uint8Array(Array.from(value, (char) => char.charCodeAt(0)));

export const byteParitySmokeFixture: RetroScreenByteParityFixture = {
  name: "byte-parity-smoke",
  description:
    "A tiny carriage-return rewrite fixture that can be replayed one byte at a time through the parity harness.",
  rows: 2,
  cols: 4,
  bytes: bytesFromLatin1("AB\rZ")
};
