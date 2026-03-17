import { describe, expect, it, vi } from "vitest";
import { createRetroLcdPromptSession } from "./prompt-session";

describe("RetroLcdPromptSession", () => {
  it("renders an initial prompt line", () => {
    const session = createRetroLcdPromptSession({
      rows: 4,
      cols: 16
    });

    const snapshot = session.getSnapshot();
    expect(snapshot.rawLines[0].startsWith("> ")).toBe(true);
  });

  it("submits accepted commands with OK and response lines", async () => {
    const onCommand = vi.fn(async () => ({
      accepted: true as const,
      response: ["alpha", "beta"]
    }));
    const session = createRetroLcdPromptSession({
      rows: 6,
      cols: 24,
      onCommand
    });

    session.setDraft("status");
    await session.submit();

    const snapshot = session.getSnapshot();
    expect(onCommand).toHaveBeenCalledWith("status");
    expect(snapshot.lines).toEqual(expect.arrayContaining(["> status", "OK", "alpha", "beta"]));
    expect(snapshot.rawLines.some((line) => line.startsWith("> "))).toBe(true);
  });

  it("submits rejected commands with ERROR by default", async () => {
    const session = createRetroLcdPromptSession({
      rows: 5,
      cols: 24,
      onCommand: () => ({ accepted: false as const })
    });

    session.setDraft("bad");
    await session.submit();

    const snapshot = session.getSnapshot();
    expect(snapshot.lines).toEqual(expect.arrayContaining(["> bad", "ERROR"]));
    expect(snapshot.rawLines.some((line) => line.startsWith("> "))).toBe(true);
  });

  it("uses custom accept and reject labels", async () => {
    const session = createRetroLcdPromptSession({
      rows: 5,
      cols: 24,
      acceptanceText: "READY",
      rejectionText: "NOPE",
      onCommand: (command) =>
        command === "go"
          ? { accepted: true as const }
          : { accepted: false as const }
    });

    session.setDraft("go");
    await session.submit();
    expect(session.getSnapshot().lines).toEqual(expect.arrayContaining(["READY"]));
    expect(session.getSnapshot().rawLines.some((line) => line.startsWith("> "))).toBe(true);

    session.setDraft("stop");
    await session.submit();
    expect(session.getSnapshot().lines).toEqual(expect.arrayContaining(["NOPE"]));
    expect(session.getSnapshot().rawLines.some((line) => line.startsWith("> "))).toBe(true);
  });

  it("suppresses the next prompt while waiting for an async response", async () => {
    let resolveCommand: ((value: { accepted: true }) => void) | undefined;
    const onCommand = vi.fn(
      () =>
        new Promise<{ accepted: true }>((resolve) => {
          resolveCommand = resolve;
        })
    );
    const session = createRetroLcdPromptSession({
      rows: 5,
      cols: 24,
      onCommand
    });

    session.setDraft("wait");
    const pending = session.submit();
    expect(session.isAwaitingResponse()).toBe(true);
    expect(session.getSnapshot().lines).toEqual(expect.arrayContaining(["> wait"]));
    expect(session.getSnapshot().lines).not.toEqual(expect.arrayContaining(["> "]));

    resolveCommand?.({ accepted: true });
    await pending;

    expect(session.isAwaitingResponse()).toBe(false);
    expect(session.getSnapshot().lines).toEqual(expect.arrayContaining(["OK"]));
    expect(session.getSnapshot().rawLines.some((line) => line.startsWith("> "))).toBe(true);
  });

  it("positions the cursor using the live draft selection", () => {
    const session = createRetroLcdPromptSession({
      rows: 4,
      cols: 10
    });

    session.setDraft("status");
    session.setSelection(2);
    session.setFocused(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.cursor.visible).toBe(true);
    expect(snapshot.cursor.row).toBe(0);
    expect(snapshot.cursor.col).toBe(4);
  });
});
