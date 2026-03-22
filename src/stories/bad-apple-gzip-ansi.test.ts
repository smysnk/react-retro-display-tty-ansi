import { describe, expect, it } from "vitest";
import {
  finalizeAnsiPayloadFromSauceTail,
  takeAnsiPayloadChunkWithSauceHoldback
} from "./bad-apple-gzip-ansi";
import { decodeRetroScreenAnsiBytes } from "../core/ansi/player";

const writeSauceText = (target: Uint8Array, offset: number, length: number, value: string) => {
  const encoded = new TextEncoder().encode(value);
  target.set(encoded.slice(0, length), offset);
};

const createSauceRecord = ({
  title,
  author,
  group,
  font,
  width,
  height
}: {
  title: string;
  author: string;
  group: string;
  font: string;
  width: number;
  height: number;
}) => {
  const sauce = new Uint8Array(128);
  const view = new DataView(sauce.buffer);

  writeSauceText(sauce, 0, 7, "SAUCE00");
  writeSauceText(sauce, 7, 35, title);
  writeSauceText(sauce, 42, 20, author);
  writeSauceText(sauce, 62, 20, group);
  writeSauceText(sauce, 106, 22, font);
  view.setUint16(96, width, true);
  view.setUint16(98, height, true);

  return sauce;
};

describe("Bad Apple gzip ANSI helpers", () => {
  it("holds back the trailing sauce bytes while streaming", () => {
    const source = Uint8Array.from({ length: 200 }, (_, index) => index);
    const { emitChunk, pendingTail } = takeAnsiPayloadChunkWithSauceHoldback(
      new Uint8Array(0),
      source
    );

    expect(emitChunk).toHaveLength(71);
    expect(pendingTail).toHaveLength(129);
    expect(Array.from(emitChunk.slice(-3))).toEqual([68, 69, 70]);
    expect(Array.from(pendingTail.slice(0, 3))).toEqual([71, 72, 73]);
  });

  it("strips the sauce record from the held-back tail and recovers metadata", () => {
    const payload = new TextEncoder().encode("AB");
    const sauce = createSauceRecord({
      title: "Bad Apple!!",
      author: "NDH",
      group: "Mistigris",
      font: "IBM VGA",
      width: 80,
      height: 25
    });
    const tail = new Uint8Array(payload.length + 1 + sauce.length);

    tail.set(payload, 0);
    tail[payload.length] = 0x1a;
    tail.set(sauce, payload.length + 1);

    const { metadata, payloadBytes } = finalizeAnsiPayloadFromSauceTail(tail);

    expect(decodeRetroScreenAnsiBytes(payloadBytes)).toBe("AB");
    expect(metadata).toMatchObject({
      title: "Bad Apple!!",
      author: "NDH",
      group: "Mistigris",
      font: "IBM VGA",
      width: 80,
      height: 25
    });
  });
});
