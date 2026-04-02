import { diffNormalizedSnapshots } from "./diff-snapshots";
import { formatBytePreview } from "./format-byte-parity-diff";
import type {
  RetroScreenByteParityAdapter,
  RetroScreenByteParityFixture,
  RetroScreenByteParityMismatch,
  RetroScreenByteParityRunResult
} from "./types";

const formatByteHex = (byte: number) => `0x${byte.toString(16).padStart(2, "0")}`;

const formatByteParityReproduction = (fixture: RetroScreenByteParityFixture, offset?: number) =>
  [
    "Byte parity reproduction:",
    `fixture=${fixture.name}`,
    `rows=${fixture.rows}`,
    `cols=${fixture.cols}`,
    typeof offset === "number" ? `untilByte=${offset}` : null
  ]
    .filter(Boolean)
    .join(" ");

const byteToChunk = (byte: number) => String.fromCharCode(byte);

const getBytePreviewWindow = (bytes: Uint8Array, offset: number, radius = 8) => {
  const start = Math.max(0, offset - radius);
  const end = Math.min(bytes.length, offset + radius + 1);
  return formatBytePreview(bytes.slice(start, end));
};

const closeAdapter = async (adapter: RetroScreenByteParityAdapter) => {
  await adapter.dispose?.();
};

export const runRealTtyByteParity = async ({
  fixture,
  retroScreen,
  reference
}: {
  fixture: RetroScreenByteParityFixture;
  retroScreen: RetroScreenByteParityAdapter;
  reference: RetroScreenByteParityAdapter;
}): Promise<RetroScreenByteParityRunResult> => {
  let mismatch: RetroScreenByteParityMismatch | null = null;
  let stepsMatched = 0;

  try {
    await retroScreen.reset?.();
    await reference.reset?.();

    for (let offset = 0; offset < fixture.bytes.length; offset += 1) {
      const byte = fixture.bytes[offset] ?? 0;
      const chunk = byteToChunk(byte);

      await retroScreen.write(chunk);
      await reference.write(chunk);

      const retroSnapshot = await retroScreen.snapshot();
      const referenceSnapshot = await reference.snapshot();
      const diffs = diffNormalizedSnapshots(retroSnapshot, referenceSnapshot);

      if (diffs.length > 0) {
        mismatch = {
          offset,
          byte,
          byteHex: formatByteHex(byte),
          bytePreview: getBytePreviewWindow(fixture.bytes, offset),
          diffs,
          retroScreen: retroSnapshot,
          reference: referenceSnapshot
        };
        break;
      }

      stepsMatched += 1;
    }
  } finally {
    await closeAdapter(retroScreen);
    await closeAdapter(reference);
  }

  return {
    fixture,
    stepsMatched,
    reproduction: formatByteParityReproduction(fixture, mismatch?.offset),
    mismatch
  };
};
