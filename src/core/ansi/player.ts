export type RetroScreenAnsiByteChunk = Uint8Array | ArrayBuffer | ArrayLike<number>;

export type RetroScreenAnsiMetadata = {
  title: string;
  author: string;
  group: string;
  font: string;
  width: number;
  height: number;
};

export type RetroScreenAnsiFrameStreamSnapshot = {
  completedFrames: readonly string[];
  currentFrame: string;
};

export type RetroScreenAnsiFrameStream = {
  appendChunk: (chunk: RetroScreenAnsiByteChunk) => RetroScreenAnsiFrameStreamSnapshot;
  appendText: (text: string) => RetroScreenAnsiFrameStreamSnapshot;
  getSnapshot: () => RetroScreenAnsiFrameStreamSnapshot;
  reset: () => void;
};

const CP437_CODE_POINTS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78,
  79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97,
  98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 199,
  252, 233, 226, 228, 224, 229, 231, 234, 235, 232, 239, 238, 236, 196, 197,
  201, 230, 198, 244, 246, 242, 251, 249, 255, 214, 220, 162, 163, 165, 8359,
  402, 225, 237, 243, 250, 241, 209, 170, 186, 191, 8976, 172, 189, 188, 161,
  171, 187, 9617, 9618, 9619, 9474, 9508, 9569, 9570, 9558, 9557, 9571, 9553,
  9559, 9565, 9564, 9563, 9488, 9492, 9524, 9516, 9500, 9472, 9532, 9566, 9567,
  9562, 9556, 9577, 9574, 9568, 9552, 9580, 9575, 9576, 9572, 9573, 9561, 9560,
  9554, 9555, 9579, 9578, 9496, 9484, 9608, 9604, 9612, 9616, 9600, 945, 223,
  915, 960, 931, 963, 181, 964, 934, 920, 937, 948, 8734, 966, 949, 8745, 8801,
  177, 8805, 8804, 8992, 8993, 247, 8776, 176, 8729, 183, 8730, 8319, 178, 9632,
  160
] as const;

const SAUCE_RECORD_SIZE = 128;
const SAUCE_SIGNATURE = "SAUCE00";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stringifyGrid = (grid: string[][]) => grid.map((row) => row.join("")).join("\n");

const decodeCp437Byte = (value: number) =>
  String.fromCodePoint(CP437_CODE_POINTS[value] ?? 32);

const readSauceText = (bytes: Uint8Array, start: number, length: number) =>
  decodeRetroScreenAnsiBytes(bytes.slice(start, start + length)).replace(/\0+$/u, "").trimEnd();

export const normalizeRetroScreenAnsiByteChunk = (
  chunk: RetroScreenAnsiByteChunk
): Uint8Array => {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }

  return Uint8Array.from(chunk);
};

export const decodeRetroScreenAnsiBytes = (bytes: Uint8Array) => {
  const decoded = new Array<string>(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    decoded[index] = decodeCp437Byte(bytes[index] ?? 32);
  }

  return decoded.join("");
};

export const findRetroScreenAnsiSauceIndex = (bytes: Uint8Array) => {
  const signatureBytes = Array.from(SAUCE_SIGNATURE, (char) => char.codePointAt(0) ?? 0);

  for (let index = bytes.length - SAUCE_RECORD_SIZE; index >= 0; index -= 1) {
    let matched = true;

    for (let offset = 0; offset < signatureBytes.length; offset += 1) {
      if (bytes[index + offset] !== signatureBytes[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return index;
    }
  }

  return -1;
};

export const stripRetroScreenAnsiSauce = (bytes: Uint8Array) => {
  const sauceIndex = findRetroScreenAnsiSauceIndex(bytes);

  if (sauceIndex < 0) {
    return bytes;
  }

  const payloadEnd =
    sauceIndex > 0 && bytes[sauceIndex - 1] === 0x1a ? sauceIndex - 1 : sauceIndex;

  return bytes.slice(0, payloadEnd);
};

export const parseRetroScreenAnsiSauce = (bytes: Uint8Array): RetroScreenAnsiMetadata => {
  const sauceIndex = findRetroScreenAnsiSauceIndex(bytes);

  if (sauceIndex < 0) {
    return {
      title: "ANSI Stream",
      author: "Unknown",
      group: "Unknown",
      font: "IBM VGA",
      width: 80,
      height: 25
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + sauceIndex, SAUCE_RECORD_SIZE);

  return {
    title: readSauceText(bytes, sauceIndex + 7, 35) || "ANSI Stream",
    author: readSauceText(bytes, sauceIndex + 42, 20) || "Unknown",
    group: readSauceText(bytes, sauceIndex + 62, 20) || "Unknown",
    width: view.getUint16(96, true) || 80,
    height: view.getUint16(98, true) || 25,
    font: readSauceText(bytes, sauceIndex + 106, 22) || "IBM VGA"
  };
};

export const splitRetroScreenAnsiBytes = (bytes: Uint8Array, chunkSize = 16384) => {
  const size = Math.max(1, Math.floor(chunkSize));
  const chunks: Uint8Array[] = [];

  for (let index = 0; index < bytes.length; index += size) {
    chunks.push(bytes.slice(index, index + size));
  }

  return chunks;
};

export const createRetroScreenAnsiFrameStream = ({
  rows,
  cols
}: {
  rows: number;
  cols: number;
}): RetroScreenAnsiFrameStream => {
  const normalizedRows = Math.max(1, Math.floor(rows));
  const normalizedCols = Math.max(1, Math.floor(cols));
  let grid = Array.from({ length: normalizedRows }, () =>
    Array.from({ length: normalizedCols }, () => " ")
  );
  let completedFrames: string[] = [];
  let currentFrameCache = stringifyGrid(grid);
  let frameDirty = false;
  let cursorRow = 0;
  let cursorCol = 0;
  let previousAbsoluteRow: number | null = null;
  let previousAbsoluteCol: number | null = null;
  let pendingEscape: string | null = null;

  const markFrameDirty = () => {
    frameDirty = true;
  };

  const getCurrentFrame = () => {
    if (frameDirty) {
      currentFrameCache = stringifyGrid(grid);
      frameDirty = false;
    }

    return currentFrameCache;
  };

  const getSnapshot = (): RetroScreenAnsiFrameStreamSnapshot => ({
    completedFrames,
    currentFrame: getCurrentFrame()
  });

  const pushCompletedFrame = () => {
    completedFrames.push(getCurrentFrame());
  };

  const newLine = () => {
    cursorCol = 0;
    cursorRow = clamp(cursorRow + 1, 0, normalizedRows - 1);
  };

  const handleCsiSequence = (sequence: string) => {
    const finalByte = sequence.at(-1) ?? "";
    const params = sequence
      .slice(2, -1)
      .split(";")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (finalByte === "H" || finalByte === "f") {
      const nextAbsoluteRow = clamp((params[0] ?? 1) - 1, 0, normalizedRows - 1);
      const nextAbsoluteCol = clamp((params[1] ?? 1) - 1, 0, normalizedCols - 1);

      if (
        previousAbsoluteRow !== null &&
        (nextAbsoluteRow < previousAbsoluteRow ||
          (nextAbsoluteRow === previousAbsoluteRow && nextAbsoluteCol < previousAbsoluteCol!))
      ) {
        pushCompletedFrame();
      }

      cursorRow = nextAbsoluteRow;
      cursorCol = nextAbsoluteCol;
      previousAbsoluteRow = nextAbsoluteRow;
      previousAbsoluteCol = nextAbsoluteCol;
      return;
    }

    if (finalByte === "C") {
      if (cursorCol === normalizedCols - 1) {
        newLine();
      }

      cursorCol = clamp(cursorCol + (params[0] ?? 1), 0, normalizedCols - 1);
    }
  };

  const appendText = (text: string) => {
    for (const character of text) {
      if (pendingEscape !== null) {
        pendingEscape += character;

        if (pendingEscape.length === 1) {
          continue;
        }

        if (pendingEscape.length === 2 && character !== "[") {
          pendingEscape = null;
          continue;
        }

        if (pendingEscape.length >= 3 && character >= "@" && character <= "~") {
          handleCsiSequence(pendingEscape);
          pendingEscape = null;
        }

        continue;
      }

      if (character === "\u001b") {
        pendingEscape = character;
        continue;
      }

      if (character === "\r") {
        cursorCol = 0;
        continue;
      }

      if (character === "\n") {
        newLine();
        continue;
      }

      grid[cursorRow]![cursorCol] = character;
      markFrameDirty();

      if (cursorCol === normalizedCols - 1) {
        newLine();
      } else {
        cursorCol += 1;
      }
    }

    return getSnapshot();
  };

  return {
    appendChunk(chunk) {
      return appendText(decodeRetroScreenAnsiBytes(normalizeRetroScreenAnsiByteChunk(chunk)));
    },
    appendText,
    getSnapshot,
    reset() {
      grid = Array.from({ length: normalizedRows }, () =>
        Array.from({ length: normalizedCols }, () => " ")
      );
      completedFrames = [];
      currentFrameCache = stringifyGrid(grid);
      frameDirty = false;
      cursorRow = 0;
      cursorCol = 0;
      previousAbsoluteRow = null;
      previousAbsoluteCol = null;
      pendingEscape = null;
    }
  };
};

export const materializeRetroScreenAnsiFrames = (
  bytesOrText: Uint8Array | string,
  rows: number,
  cols: number
) => {
  const stream = createRetroScreenAnsiFrameStream({ rows, cols });
  const snapshot =
    typeof bytesOrText === "string" ? stream.appendText(bytesOrText) : stream.appendChunk(bytesOrText);

  return [...snapshot.completedFrames, snapshot.currentFrame];
};
