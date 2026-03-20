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

  it("batches writeMany into a single notification and replays it after resize", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 4 });
    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    controller.writeMany(["AB", { data: "CD", options: { appendNewline: true } }, "EF"]);

    expect(notifications).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      lines: ["ABCD", "EF"]
    });

    controller.resize(3, 3);

    expect(controller.getSnapshot()).toMatchObject({
      rows: 3,
      cols: 3,
      lines: ["ABC", "D", "EF"]
    });
  });

  it("flushes exactly one notification for nested batches and suspended notifications", () => {
    const controller = createRetroLcdController({ rows: 2, cols: 4 });
    let notifications = 0;
    controller.subscribe(() => {
      notifications += 1;
    });

    controller.suspendNotifications();
    controller.write("AB");
    controller.batch(() => {
      controller.write("CD");
      controller.setCursorVisible(false);
    });

    expect(notifications).toBe(0);

    controller.resumeNotifications();

    expect(notifications).toBe(1);
    expect(controller.getSnapshot()).toMatchObject({
      lines: ["ABCD", ""],
      cursor: {
        visible: false
      }
    });
  });
});
