import { describe, expect, it } from "vitest";
import { createHeadlessByteParityAdapter } from "./headless-byte-parity-adapter";
import { createRetroByteParityAdapter } from "./retro-byte-parity-adapter";
import { formatByteParityReport } from "./format-byte-parity-diff";
import { byteParitySmokeFixture } from "./fixtures/byte-parity-smoke.fixture";
import { runRealTtyByteParity } from "./run-real-tty-byte-parity";

describe("real tty byte parity skeleton", () => {
  it("replays a tiny fixture byte by byte without divergence", async () => {
    const result = await runRealTtyByteParity({
      fixture: byteParitySmokeFixture,
      retroScreen: createRetroByteParityAdapter(byteParitySmokeFixture),
      reference: createHeadlessByteParityAdapter(byteParitySmokeFixture)
    });

    expect(result.mismatch, formatByteParityReport(result)).toBeNull();
    expect(result.stepsMatched).toBe(byteParitySmokeFixture.bytes.length);
  });

  it("reports the first differing byte offset when playback diverges", async () => {
    const retroScreen = createRetroByteParityAdapter(byteParitySmokeFixture);
    let writeCount = 0;
    const originalWrite = retroScreen.write.bind(retroScreen);

    retroScreen.write = async (chunk: string) => {
      writeCount += 1;
      await originalWrite(writeCount === 2 ? "X" : chunk);
    };

    const result = await runRealTtyByteParity({
      fixture: byteParitySmokeFixture,
      retroScreen,
      reference: createHeadlessByteParityAdapter(byteParitySmokeFixture)
    });

    expect(result.mismatch).not.toBeNull();
    expect(result.mismatch?.offset).toBe(1);
    expect(formatByteParityReport(result)).toContain("first divergence at byte offset 1");
  });
});
