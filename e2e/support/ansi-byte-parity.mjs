import xtermHeadless from "@xterm/headless";

const { Terminal } = xtermHeadless;

const DEFAULT_COLOR = {
  mode: "default",
  value: 0
};

const normalizeColor = (cell, type) => {
  const isDefault = type === "foreground" ? cell.isFgDefault() : cell.isBgDefault();

  if (isDefault) {
    return DEFAULT_COLOR;
  }

  const isPalette = type === "foreground" ? cell.isFgPalette() : cell.isBgPalette();

  if (isPalette) {
    return {
      mode: "palette",
      value: type === "foreground" ? cell.getFgColor() : cell.getBgColor()
    };
  }

  const isRgb = type === "foreground" ? cell.isFgRGB() : cell.isBgRGB();

  if (isRgb) {
    return {
      mode: "rgb",
      value: type === "foreground" ? cell.getFgColor() : cell.getBgColor()
    };
  }

  return DEFAULT_COLOR;
};

const normalizeCell = (cell) => ({
  char: cell.getChars() || " ",
  width: cell.getWidth() || 1,
  style: {
    bold: Boolean(cell.isBold()),
    faint: Boolean(cell.isDim()),
    inverse: Boolean(cell.isInverse()),
    conceal: Boolean(cell.isInvisible()),
    blink: Boolean(cell.isBlink()),
    foreground: normalizeColor(cell, "foreground"),
    background: normalizeColor(cell, "background")
  }
});

const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const getLineString = (buffer, y, trimRight) =>
  buffer.getLine(y)?.translateToString(trimRight, 0, buffer.getLine(y)?.length ?? 0) ?? "";

const getRawLineString = (buffer, y, cols) =>
  buffer.getLine(y)?.translateToString(false, 0, cols) ?? "".padEnd(cols, " ");

const getNormalizedCells = (buffer, y, cols) => {
  const line = buffer.getLine(y);
  const scratch = buffer.getNullCell();

  return Array.from({ length: cols }, (_, colIndex) => normalizeCell(line?.getCell(colIndex, scratch) ?? scratch));
};

export const normalizeHeadlessTerminalSnapshot = (terminal) => {
  const buffer = terminal.buffer.active;
  const visibleLineIndices = Array.from({ length: terminal.rows }, (_, rowIndex) => buffer.viewportY + rowIndex);
  const scrollbackIndices = Array.from({ length: buffer.baseY }, (_, index) => index);

  return {
    source: "xterm-headless",
    rows: terminal.rows,
    cols: terminal.cols,
    viewportY: buffer.viewportY,
    baseY: buffer.baseY,
    lines: visibleLineIndices.map((index) => getLineString(buffer, index, true)),
    rawLines: visibleLineIndices.map((index) => getRawLineString(buffer, index, terminal.cols)),
    wrapped: visibleLineIndices.map((index) => buffer.getLine(index)?.isWrapped ?? false),
    cells: visibleLineIndices.map((index) => getNormalizedCells(buffer, index, terminal.cols)),
    scrollback: scrollbackIndices.map((index) => getLineString(buffer, index, true)),
    cursor: {
      row: buffer.cursorY,
      col: buffer.cursorX,
      visible: null
    },
    pendingWrap: terminal.modes.wraparoundMode && buffer.cursorX === terminal.cols,
    modes: {
      insertMode: terminal.modes.insertMode,
      originMode: terminal.modes.originMode,
      wraparoundMode: terminal.modes.wraparoundMode
    }
  };
};

export const diffSnapshots = (actual, expected) => {
  const diffs = [];

  if (actual.rows !== expected.rows || actual.cols !== expected.cols) {
    diffs.push(
      `geometry mismatch: retro-lcd=${actual.rows}x${actual.cols} xterm=${expected.rows}x${expected.cols}`
    );
  }

  if (actual.cursor.row !== expected.cursor.row || actual.cursor.col !== expected.cursor.col) {
    diffs.push(
      `cursor mismatch: retro-lcd=(${actual.cursor.row},${actual.cursor.col}) xterm=(${expected.cursor.row},${expected.cursor.col})`
    );
  }

  if (
    actual.cursor.visible !== null &&
    expected.cursor.visible !== null &&
    actual.cursor.visible !== expected.cursor.visible
  ) {
    diffs.push(
      `cursor visibility mismatch: retro-lcd=${String(actual.cursor.visible)} xterm=${String(expected.cursor.visible)}`
    );
  }

  if (!sameValue(actual.scrollback, expected.scrollback)) {
    diffs.push(
      `scrollback mismatch: retro-lcd=${JSON.stringify(actual.scrollback)} xterm=${JSON.stringify(expected.scrollback)}`
    );
  }

  if (actual.pendingWrap !== null && expected.pendingWrap !== null && actual.pendingWrap !== expected.pendingWrap) {
    diffs.push(
      `pending wrap mismatch: retro-lcd=${String(actual.pendingWrap)} xterm=${String(expected.pendingWrap)}`
    );
  }

  if (!sameValue(actual.modes, expected.modes)) {
    diffs.push(
      `mode mismatch: retro-lcd=${JSON.stringify(actual.modes)} xterm=${JSON.stringify(expected.modes)}`
    );
  }

  for (let rowIndex = 0; rowIndex < Math.max(actual.rawLines.length, expected.rawLines.length); rowIndex += 1) {
    const actualLine = actual.rawLines[rowIndex] ?? "";
    const expectedLine = expected.rawLines[rowIndex] ?? "";

    if (actualLine !== expectedLine) {
      diffs.push(
        `line ${rowIndex} mismatch: retro-lcd=${JSON.stringify(actualLine)} xterm=${JSON.stringify(expectedLine)}`
      );
    }

    const actualCells = actual.cells[rowIndex] ?? [];
    const expectedCells = expected.cells[rowIndex] ?? [];

    for (let colIndex = 0; colIndex < Math.max(actualCells.length, expectedCells.length); colIndex += 1) {
      const actualCell = actualCells[colIndex];
      const expectedCell = expectedCells[colIndex];

      if (!actualCell || !expectedCell) {
        diffs.push(`cell ${rowIndex},${colIndex} missing`);
        continue;
      }

      if (!sameValue(actualCell, expectedCell)) {
        diffs.push(
          `cell ${rowIndex},${colIndex} mismatch: retro-lcd=${JSON.stringify(actualCell)} xterm=${JSON.stringify(expectedCell)}`
        );
      }
    }
  }

  return diffs;
};

const byteToChunk = (byte) => String.fromCharCode(byte & 0xff);
const bytesToChunk = (bytes) => Array.from(bytes, (byte) => byteToChunk(byte)).join("");

const formatPreview = (bytes, offset, radius = 8) => {
  const start = Math.max(0, offset - radius);
  const end = Math.min(bytes.length, offset + radius + 1);
  return Array.from(bytes.slice(start, end), (byte) => byteToChunk(byte))
    .join("")
    .replace(/\\/gu, "\\\\")
    .replace(/\r/gu, "\\r")
    .replace(/\n/gu, "\\n")
    .replace(/\u001b/gu, "\\u001b");
};

const writeToHeadlessTerminal = async (terminal, chunk) => {
  await new Promise((resolve) => {
    terminal.write(chunk, () => resolve());
  });
};

const createComparisonOffsets = (fixture, sampling) => {
  if (!sampling || sampling.mode === "every-byte") {
    return Array.from({ length: fixture.bytes.length }, (_, index) => index);
  }

  const warmupBytes = Math.max(0, Math.min(fixture.bytes.length, sampling.warmupBytes));
  const stride = Math.max(1, sampling.sampleEvery);
  const offsets = [];

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

const resetBrowserHarness = async (page, fixture) => {
  await page.evaluate(
    async ({ rows, cols }) => {
      const api = window.__RETRO_SCREEN_ANSI_PARITY__;

      if (!api) {
        throw new Error("Missing ANSI parity harness API.");
      }

      await api.reset({ rows, cols });
      await api.flush();
    },
    { rows: fixture.rows, cols: fixture.cols }
  );
};

const writeBytesToBrowserHarness = async (page, bytes) => {
  await page.evaluate(async (nextBytes) => {
    const api = window.__RETRO_SCREEN_ANSI_PARITY__;

    if (!api) {
      throw new Error("Missing ANSI parity harness API.");
    }

    await api.writeBytes(nextBytes);
    await api.flush();
  }, Array.from(bytes));
};

const readBrowserSnapshot = async (page) =>
  page.evaluate(() => window.__RETRO_SCREEN_ANSI_PARITY__?.snapshot() ?? null);

const runBrowserByteParityUntilOffsets = async ({ page, fixture, comparisonOffsets }) => {
  const terminal = new Terminal({
    allowProposedApi: true,
    rows: fixture.rows,
    cols: fixture.cols,
    scrollback: fixture.rows * 8
  });

  try {
    await resetBrowserHarness(page, fixture);
    let previousOffset = -1;

    for (const offset of comparisonOffsets) {
      const nextChunk = fixture.bytes.slice(previousOffset + 1, offset + 1);

      if (nextChunk.length > 0) {
        await writeToHeadlessTerminal(terminal, bytesToChunk(nextChunk));
        await writeBytesToBrowserHarness(page, nextChunk);
      }

      const actual = await readBrowserSnapshot(page);
      const expected = normalizeHeadlessTerminalSnapshot(terminal);

      if (!actual) {
        return {
          offset,
          diffs: ["browser harness returned no snapshot"],
          expected
        };
      }

      const diffs = diffSnapshots(actual, expected);

      if (diffs.length > 0) {
        return {
          offset,
          byte: fixture.bytes[offset] ?? 0,
          preview: formatPreview(fixture.bytes, offset),
          diffs,
          actual,
          expected
        };
      }

      previousOffset = offset;
    }

    return null;
  } finally {
    terminal.dispose();
  }
};

const locateExactMismatchWithinWindow = async ({ page, fixture, startOffset, endOffset }) => {
  const terminal = new Terminal({
    allowProposedApi: true,
    rows: fixture.rows,
    cols: fixture.cols,
    scrollback: fixture.rows * 8
  });

  try {
    await resetBrowserHarness(page, fixture);

    if (startOffset > 0) {
      const prefix = fixture.bytes.slice(0, startOffset);
      await writeToHeadlessTerminal(terminal, bytesToChunk(prefix));
      await writeBytesToBrowserHarness(page, prefix);
    }

    for (let offset = startOffset; offset <= endOffset; offset += 1) {
      const nextByte = fixture.bytes[offset] ?? 0;
      const chunk = byteToChunk(nextByte);

      await writeToHeadlessTerminal(terminal, chunk);
      await writeBytesToBrowserHarness(page, Uint8Array.of(nextByte));

      const actual = await readBrowserSnapshot(page);
      const expected = normalizeHeadlessTerminalSnapshot(terminal);

      if (!actual) {
        return {
          offset,
          diffs: ["browser harness returned no snapshot"],
          expected
        };
      }

      const diffs = diffSnapshots(actual, expected);

      if (diffs.length > 0) {
        return {
          offset,
          byte: nextByte,
          preview: formatPreview(fixture.bytes, offset),
          diffs,
          actual,
          expected
        };
      }
    }

    return null;
  } finally {
    terminal.dispose();
  }
};

export const runBrowserByteParityTrace = async ({ page, fixture, sampling = { mode: "every-byte" } }) => {
  const comparisonOffsets = createComparisonOffsets(fixture, sampling);
  const mismatch = await runBrowserByteParityUntilOffsets({
    page,
    fixture,
    comparisonOffsets
  });

  if (!mismatch) {
    return null;
  }

  if (sampling.mode !== "sample-after-warmup" || sampling.locateExactMismatch === false) {
    return mismatch;
  }

  const mismatchIndex = comparisonOffsets.indexOf(mismatch.offset);
  const previousVerifiedOffset = mismatchIndex > 0 ? (comparisonOffsets[mismatchIndex - 1] ?? -1) : -1;

  const exactMismatch = await locateExactMismatchWithinWindow({
    page,
    fixture,
    startOffset: previousVerifiedOffset + 1,
    endOffset: mismatch.offset
  });

  return exactMismatch ?? mismatch;
};
