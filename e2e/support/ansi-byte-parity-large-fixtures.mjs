import { readFile } from "node:fs/promises";

const badAppleAnsiUrl = new URL("../../src/stories/assets/bad-apple.ans", import.meta.url);

export const loadBadAppleAnsiByteFixture = async ({ maxBytes } = {}) => {
  const bytes = new Uint8Array(await readFile(badAppleAnsiUrl));

  return {
    name: maxBytes ? `bad-apple-ansi-prefix-${maxBytes}` : "bad-apple-ansi",
    rows: 25,
    cols: 80,
    bytes: typeof maxBytes === "number" && maxBytes > 0 ? bytes.slice(0, maxBytes) : bytes
  };
};
