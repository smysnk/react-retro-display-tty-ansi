import { diffNormalizedSnapshots } from "./diff-snapshots";
import type {
  RetroScreenByteParityAdapter,
  RetroScreenByteParityFixture,
  RetroScreenByteParityMismatch,
  RetroScreenByteParityRunResult
} from "./types";

export type RetroScreenByteParitySampling =
  | {
      mode: "every-byte";
    }
  | {
      mode: "sample-after-warmup";
      warmupBytes: number;
      sampleEvery: number;
      locateExactMismatch?: boolean;
    };

const byteToChunk = (byte: number) => String.fromCharCode(byte & 0xff);
const bytesToChunk = (bytes: Uint8Array) => Array.from(bytes, (byte) => byteToChunk(byte)).join("");
const formatByteHex = (byte: number) => `0x${byte.toString(16).padStart(2, "0")}`;

const formatBytePreview = (bytes: Uint8Array, offset: number, radius = 8) => {
  const start = Math.max(0, offset - radius);
  const end = Math.min(bytes.length, offset + radius + 1);

  return Array.from(bytes.slice(start, end), (byte) => byteToChunk(byte))
    .join("")
    .replace(/\\/gu, "\\\\")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n")
    .replace(/\u001b/gu, "\\u001b");
};

const formatSampledReproduction = (
  fixture: RetroScreenByteParityFixture,
  offset: number | undefined,
  sampling: RetroScreenByteParitySampling
) =>
  [
    "Sampled byte parity reproduction:",
    `fixture=${fixture.name}`,
    `rows=${fixture.rows}`,
    `cols=${fixture.cols}`,
    `sampling=${sampling.mode}`,
    sampling.mode === "sample-after-warmup" ? `warmupBytes=${sampling.warmupBytes}` : null,
    sampling.mode === "sample-after-warmup" ? `sampleEvery=${sampling.sampleEvery}` : null,
    typeof offset === "number" ? `untilByte=${offset}` : null
  ]
    .filter(Boolean)
    .join(" ");

const closeAdapter = async (adapter: RetroScreenByteParityAdapter) => {
  await adapter.dispose?.();
};

const writeChunkPair = async (
  retroScreen: RetroScreenByteParityAdapter,
  reference: RetroScreenByteParityAdapter,
  chunk: string
) => {
  await retroScreen.write(chunk);
  await reference.write(chunk);
};

const buildMismatch = async ({
  fixture,
  retroScreen,
  reference,
  offset,
  byte
}: {
  fixture: RetroScreenByteParityFixture;
  retroScreen: RetroScreenByteParityAdapter;
  reference: RetroScreenByteParityAdapter;
  offset: number;
  byte: number;
}): Promise<RetroScreenByteParityMismatch | null> => {
  const retroSnapshot = await retroScreen.snapshot();
  const referenceSnapshot = await reference.snapshot();
  const diffs = diffNormalizedSnapshots(retroSnapshot, referenceSnapshot);

  if (diffs.length === 0) {
    return null;
  }

  return {
    offset,
    byte,
    byteHex: formatByteHex(byte),
    bytePreview: formatBytePreview(fixture.bytes, offset),
    diffs,
    retroScreen: retroSnapshot,
    reference: referenceSnapshot
  };
};

const createComparisonOffsets = (
  fixture: RetroScreenByteParityFixture,
  sampling: RetroScreenByteParitySampling
) => {
  if (sampling.mode === "every-byte") {
    return Array.from({ length: fixture.bytes.length }, (_, index) => index);
  }

  const warmupBytes = Math.max(0, Math.min(fixture.bytes.length, sampling.warmupBytes));
  const stride = Math.max(1, sampling.sampleEvery);
  const offsets: number[] = [];

  for (let offset = 0; offset < warmupBytes; offset += 1) {
    offsets.push(offset);
  }

  for (let offset = warmupBytes + stride - 1; offset < fixture.bytes.length; offset += stride) {
    offsets.push(offset);
  }

  const finalOffset = fixture.bytes.length - 1;

  if (finalOffset >= 0 && offsets.at(-1) !== finalOffset) {
    offsets.push(finalOffset);
  }

  return offsets;
};

const resetAdapters = async (
  retroScreen: RetroScreenByteParityAdapter,
  reference: RetroScreenByteParityAdapter
) => {
  await retroScreen.reset?.();
  await reference.reset?.();
};

const locateExactMismatchWithinWindow = async ({
  fixture,
  retroScreen,
  reference,
  startOffset,
  endOffset
}: {
  fixture: RetroScreenByteParityFixture;
  retroScreen: RetroScreenByteParityAdapter;
  reference: RetroScreenByteParityAdapter;
  startOffset: number;
  endOffset: number;
}) => {
  await resetAdapters(retroScreen, reference);

  if (startOffset > 0) {
    const prefix = fixture.bytes.slice(0, startOffset);
    await writeChunkPair(retroScreen, reference, bytesToChunk(prefix));
  }

  for (let offset = startOffset; offset <= endOffset; offset += 1) {
    const byte = fixture.bytes[offset] ?? 0;
    await writeChunkPair(retroScreen, reference, byteToChunk(byte));
    const mismatch = await buildMismatch({
      fixture,
      retroScreen,
      reference,
      offset,
      byte
    });

    if (mismatch) {
      return mismatch;
    }
  }

  return null;
};

export const runSampledByteParity = async ({
  fixture,
  retroScreen,
  reference,
  sampling
}: {
  fixture: RetroScreenByteParityFixture;
  retroScreen: RetroScreenByteParityAdapter;
  reference: RetroScreenByteParityAdapter;
  sampling: RetroScreenByteParitySampling;
}): Promise<RetroScreenByteParityRunResult> => {
  let mismatch: RetroScreenByteParityMismatch | null = null;
  let stepsMatched = 0;

  try {
    await resetAdapters(retroScreen, reference);
    const comparisonOffsets = createComparisonOffsets(fixture, sampling);
    let previousOffset = -1;

    for (const offset of comparisonOffsets) {
      const nextChunk = fixture.bytes.slice(previousOffset + 1, offset + 1);

      if (nextChunk.length > 0) {
        await writeChunkPair(retroScreen, reference, bytesToChunk(nextChunk));
      }

      mismatch = await buildMismatch({
        fixture,
        retroScreen,
        reference,
        offset,
        byte: fixture.bytes[offset] ?? 0
      });

      if (mismatch) {
        if (sampling.mode === "sample-after-warmup" && sampling.locateExactMismatch !== false) {
          const exactMismatch = await locateExactMismatchWithinWindow({
            fixture,
            retroScreen,
            reference,
            startOffset: previousOffset + 1,
            endOffset: offset
          });

          mismatch = exactMismatch ?? mismatch;
        }

        break;
      }

      stepsMatched = offset + 1;
      previousOffset = offset;
    }

    if (!mismatch) {
      stepsMatched = fixture.bytes.length;
    }
  } finally {
    await closeAdapter(retroScreen);
    await closeAdapter(reference);
  }

  return {
    fixture,
    stepsMatched,
    reproduction: formatSampledReproduction(fixture, mismatch?.offset, sampling),
    mismatch
  };
};
