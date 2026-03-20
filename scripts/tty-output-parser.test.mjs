import { describe, expect, it } from "vitest";
import { createTtyOutputParser } from "./tty-output-parser.mjs";

describe("createTtyOutputParser", () => {
  it("removes OSC title sequences and reports titles separately", () => {
    const parse = createTtyOutputParser();

    expect(parse("\u001b]0;Retro TTY\u0007READY\r\n")).toEqual({
      data: "READY\r\n",
      titles: ["Retro TTY"],
      bellCount: 0
    });
  });

  it("counts bells that are not part of OSC termination", () => {
    const parse = createTtyOutputParser();

    expect(parse("alpha\u0007beta")).toEqual({
      data: "alphabeta",
      titles: [],
      bellCount: 1
    });
  });

  it("supports split OSC title chunks", () => {
    const parse = createTtyOutputParser();

    expect(parse("\u001b]2;Split")).toEqual({
      data: "",
      titles: [],
      bellCount: 0
    });
    expect(parse(" Title\u0007done")).toEqual({
      data: "done",
      titles: ["Split Title"],
      bellCount: 0
    });
  });
});
