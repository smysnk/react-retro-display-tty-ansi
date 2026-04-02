import { describe, expect, it } from "vitest";
import { createHeadlessByteParityAdapter } from "./headless-byte-parity-adapter";
import { createRetroByteParityAdapter } from "./retro-byte-parity-adapter";
import { formatByteParityReport } from "./format-byte-parity-diff";
import { byteParityPhase2Corpus } from "./fixtures/ansi-parity-corpus";
import { runRealTtyByteParity } from "./run-real-tty-byte-parity";

const runCorpusOnce = async () => {
  const results = [];

  for (const entry of byteParityPhase2Corpus) {
    const result = await runRealTtyByteParity({
      fixture: entry.fixture,
      retroScreen: createRetroByteParityAdapter(entry.fixture),
      reference: createHeadlessByteParityAdapter(entry.fixture)
    });
    results.push({
      id: entry.id,
      result
    });
  }

  return results;
};

describe("real tty byte parity phase 2 corpus", () => {
  it("covers at least ten focused display-facing fixtures", () => {
    expect(byteParityPhase2Corpus.length).toBeGreaterThanOrEqual(10);
  });

  it("matches the curated phase 2 display-facing corpus byte by byte", async () => {
    const results = await runCorpusOnce();

    for (const { id, result } of results) {
      expect(result.mismatch, `${id}\n${formatByteParityReport(result)}`).toBeNull();
      expect(result.stepsMatched).toBe(result.fixture.bytes.length);
    }
  });

  it("remains stable across immediate reruns of the same byte corpus", async () => {
    const firstPass = await runCorpusOnce();
    const secondPass = await runCorpusOnce();

    expect(firstPass).toHaveLength(secondPass.length);

    for (let index = 0; index < firstPass.length; index += 1) {
      const first = firstPass[index];
      const second = secondPass[index];

      expect(first?.id).toBe(second?.id);
      expect(first?.result.mismatch, first?.id).toEqual(second?.result.mismatch);
      expect(first?.result.stepsMatched, first?.id).toBe(second?.result.stepsMatched);
    }
  });
});
