import { describe, expect, it } from "vitest";
import { createRetroLcdController } from "./controller";

describe("createRetroLcdController", () => {
  it("writes and notifies subscribers", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 4 });
    let notifications = 0;
    const unsubscribe = controller.subscribe(() => {
      notifications += 1;
    });

    controller.write("ABCD");
    unsubscribe();
    controller.write("E");

    expect(controller.getSnapshot()).toMatchObject({
      lines: ["ABCD", "E"]
    });
    expect(notifications).toBe(1);
  });

  it("replays history when resized", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 4 });

    controller.write("ABCDE");
    controller.resize(3, 3);

    expect(controller.getSnapshot()).toMatchObject({
      rows: 3,
      cols: 3,
      lines: ["ABC", "DE", ""]
    });
  });

  it("preserves cursor mode and visibility state", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 4 });

    controller.setCursorMode("hollow");
    controller.setCursorVisible(false);
    controller.resize(3, 5);

    expect(controller.getSnapshot().cursor).toMatchObject({
      mode: "hollow",
      visible: false
    });
  });

  it("replays ansi writes after resize", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 6 });

    controller.write("HELLO");
    controller.write("\u001b[2D");
    controller.write("Z");
    controller.resize(3, 4);

    expect(controller.getSnapshot()).toMatchObject({
      rows: 3,
      cols: 4,
      lines: ["HELL", "Z", ""]
    });
  });

  it("scrolls older rows into scrollback when writes exceed the visible height", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 8 });

    controller.writeln("alpha");
    controller.writeln("beta");
    controller.writeln("gamma");

    expect(controller.getSnapshot()).toMatchObject({
      lines: ["gamma", ""],
      scrollback: ["alpha", "beta"]
    });
  });
});
