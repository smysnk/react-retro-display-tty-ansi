import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/headless";

import {
  createRetroScreenAnsiFrameStream,
  createRetroScreenAnsiSnapshotStream,
  decodeRetroScreenAnsiBytes,
  materializeRetroScreenAnsiFrames,
  materializeRetroScreenAnsiSnapshots,
  stripRetroScreenAnsiSauce,
} from "./player";
import { normalizeXtermSnapshot } from "../terminal/conformance/normalize-xterm";

const ansiDir =
  typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const solidWaste87260FixturePath = resolve(ansiDir, "fixtures/solid-waste-87260.ans.gz");

const loadSolidWaste87260Fixture = async () =>
  new Uint8Array(gunzipSync(await readFile(solidWaste87260FixturePath)));

describe("ANSI snapshot stream", () => {
  it("preserves true source rows and cols while exposing line arrays", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 3,
      cols: 6,
      metadata: {
        title: "demo",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 6,
        height: 3,
      },
    });
    const snapshot = stream.appendText("\u001b[1;1HAB\u001b[2;3HCD");

    expect(snapshot.sourceRows).toBe(3);
    expect(snapshot.sourceCols).toBe(6);
    expect(snapshot.storageMode).toBe("eager");
    expect(snapshot.currentFrame.lines).toEqual([
      "AB    ",
      "  CD  ",
      "      ",
    ]);
    expect(snapshot.currentFrame.text).toBe("AB    \n  CD  \n      ");
    expect(snapshot.metadata?.title).toBe("demo");
  });

  it("parses ANSI SGR colors into styled cells", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
      metadata: {
        title: "color",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 4,
        height: 2,
      },
    });
    const snapshot = stream.appendText("\u001b[31;44mA \u001b[93;102mB");
    const firstSlice = snapshot.currentFrame.getCellSlice(0, 0, 4);

    expect(firstSlice[0]).toMatchObject({
      char: "A",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
    expect(firstSlice[1]).toMatchObject({
      char: " ",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
    expect(firstSlice[2]).toMatchObject({
      char: "B",
      style: {
        foreground: {
          mode: "palette",
          value: 11,
        },
        background: {
          mode: "palette",
          value: 10,
        },
      },
    });
  });

  it("keeps completed frames in snapshot form and stays compatible with the string player", () => {
    const payload = "\u001b[24;1Htail\u001b[1;1Hhead";
    const snapshotFrames = materializeRetroScreenAnsiSnapshots(payload, 25, 8);
    const stringFrames = materializeRetroScreenAnsiFrames(payload, 25, 8);
    const stringStreamSnapshot = createRetroScreenAnsiFrameStream({ rows: 25, cols: 8 }).appendText(payload);

    expect(snapshotFrames).toHaveLength(2);
    expect(snapshotFrames.map((frame) => frame.text)).toEqual(stringFrames);
    expect(stringStreamSnapshot.completedFrames).toEqual([snapshotFrames[0]?.text]);
    expect(stringStreamSnapshot.currentFrame).toBe(snapshotFrames[1]?.text);
  });

  it("supports sparse snapshots for huge geometries without flattening the full buffer", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 20_480,
      storageMode: "sparse",
      metadata: {
        title: "huge",
        author: "artist",
        group: "crew",
        font: "IBM VGA",
        width: 20_480,
        height: 25,
      },
    });
    const snapshot = stream.appendText("\u001b[1;20479HXY");

    expect(snapshot.storageMode).toBe("sparse");
    expect(snapshot.sourceCols).toBe(20_480);
    expect(snapshot.currentFrame.lines).toHaveLength(25);
    expect(snapshot.currentFrame.getLineSlice(0, 20_478, 20_480)).toBe("XY");
    expect(snapshot.currentFrame.text.length).toBeLessThanOrEqual(25 * 80 + 24);
  });

  it("freezes completed sparse frames when later cursor jumps create a new frame", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 20_480,
      storageMode: "sparse",
    });
    const snapshot = stream.appendText("\u001b[1;20479HAB\u001b[1;1HCD");

    expect(snapshot.completedFrames).toHaveLength(1);
    expect(snapshot.completedFrames[0]?.storageMode).toBe("sparse");
    expect(snapshot.completedFrames[0]?.getLineSlice(0, 20_478, 20_480)).toBe("AB");
    expect(snapshot.currentFrame.getLineSlice(0, 0, 2)).toBe("CD");
  });

  it("preserves styled spaces in sparse snapshots", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 20_480,
      storageMode: "sparse",
    });
    const snapshot = stream.appendText("\u001b[1;20479H\u001b[31;44m ");
    const coloredSpace = snapshot.currentFrame.getCellSlice(0, 20_478, 20_479)[0];

    expect(coloredSpace).toMatchObject({
      char: " ",
      style: {
        foreground: {
          mode: "palette",
          value: 1,
        },
        background: {
          mode: "palette",
          value: 4,
        },
      },
    });
  });

  it("preserves delayed-wrap semantics when carriage return clears a full-width pending wrap", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("ABCD\rEF");

    expect(snapshot.currentFrame.lines).toEqual([
      "EFCD",
      "    ",
    ]);
  });

  it("normalizes pending wrap before CSI cursor movement commands", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("ABCD\u001b[DZ");

    expect(snapshot.currentFrame.lines).toEqual([
      "ABZD",
      "    ",
    ]);
  });

  it("scrolls the visible viewport upward when line feed lands on the bottom row", () => {
    const stream = createRetroScreenAnsiSnapshotStream({
      rows: 2,
      cols: 4,
    });
    const snapshot = stream.appendText("AAAA\r\nBBBB\r\nCCCC");

    expect(snapshot.currentFrame.lines).toEqual([
      "BBBB",
      "CCCC",
    ]);
  });

  it("matches the terminal reference for the Solid Waste 87260 artifact", async () => {
    const rawBytes = await loadSolidWaste87260Fixture();
    const payloadBytes = stripRetroScreenAnsiSauce(rawBytes);
    const terminal = new Terminal({
      allowProposedApi: true,
      rows: 25,
      cols: 80,
      scrollback: 200,
    });
    const decodedText = decodeRetroScreenAnsiBytes(payloadBytes);

    await new Promise<void>((resolveWrite) => {
      terminal.write(decodedText, () => resolveWrite());
    });

    const referenceSnapshot = normalizeXtermSnapshot(terminal);
    const snapshot = createRetroScreenAnsiSnapshotStream({
      rows: 25,
      cols: 80,
    }).appendChunk(payloadBytes);

    expect(snapshot.currentFrame.lines).toEqual(referenceSnapshot.rawLines);
    terminal.dispose();
  });
});
