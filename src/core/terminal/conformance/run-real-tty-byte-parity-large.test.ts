import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createHeadlessByteParityAdapter } from "./headless-byte-parity-adapter";
import { createRetroByteParityAdapter } from "./retro-byte-parity-adapter";
import { formatByteParityReport } from "./format-byte-parity-diff";
import { runRealTtyByteParity } from "./run-real-tty-byte-parity";
import type { RetroScreenByteParityFixture } from "./types";

const conformanceDir =
  typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(conformanceDir, "../../..");
const badAppleAnsiPath = resolve(rootDir, "stories/assets/bad-apple.ans");

const loadBadAppleFixture = async (): Promise<RetroScreenByteParityFixture> => ({
  name: "bad-apple-ansi-full",
  description:
    "The full Bad Apple ANSI asset should remain byte-exact under the parity runner when the nightly large-file suite is enabled.",
  rows: 25,
  cols: 80,
  bytes: new Uint8Array(await readFile(badAppleAnsiPath))
});

const maybeIt = process.env.ANSI_BYTE_PARITY_LARGE === "1" ? it : it.skip;

describe("real tty byte parity large ansi corpus", () => {
  maybeIt("replays the full Bad Apple ANSI asset byte by byte", async () => {
    const fixture = await loadBadAppleFixture();
    const result = await runRealTtyByteParity({
      fixture,
      retroScreen: createRetroByteParityAdapter(fixture),
      reference: createHeadlessByteParityAdapter(fixture)
    });

    expect(result.mismatch, formatByteParityReport(result)).toBeNull();
    expect(result.stepsMatched).toBe(fixture.bytes.length);
  });
});
