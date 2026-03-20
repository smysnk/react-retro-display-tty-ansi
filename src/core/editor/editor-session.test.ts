import { describe, expect, it } from "vitest";
import { createRetroLcdEditorSession } from "./editor-session";

describe("createRetroLcdEditorSession", () => {
  it("creates a collapsed cursor at the end of the initial value by default", () => {
    const session = createRetroLcdEditorSession({
      value: "retro"
    });

    expect(session.getState()).toEqual({
      value: "retro",
      placeholder: "",
      editable: true,
      cursorMode: "solid",
      selection: {
        start: 5,
        end: 5
      }
    });
  });

  it("normalizes reverse selections from the constructor", () => {
    const session = createRetroLcdEditorSession({
      value: "display",
      selectionStart: 6,
      selectionEnd: 2
    });

    expect(session.getSelection()).toEqual({
      start: 2,
      end: 6
    });
  });

  it("deletes the active selection with backspace", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display"
    });

    session.setSelection(6, 13);
    const changed = session.deleteBackward();

    expect(changed).toBe(true);
    expect(session.getValue()).toBe("retro ");
    expect(session.getSelection()).toEqual({
      start: 6,
      end: 6
    });
  });

  it("deletes the active selection with delete", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display"
    });

    session.setSelection(0, 6);
    const changed = session.deleteForward();

    expect(changed).toBe(true);
    expect(session.getValue()).toBe("display");
    expect(session.getSelection()).toEqual({
      start: 0,
      end: 0
    });
  });

  it("deletes one character backward when the selection is collapsed", () => {
    const session = createRetroLcdEditorSession({
      value: "retro"
    });

    session.moveCursorTo(3);
    const changed = session.deleteBackward();

    expect(changed).toBe(true);
    expect(session.getValue()).toBe("rero");
    expect(session.getSelection()).toEqual({
      start: 2,
      end: 2
    });
  });

  it("deletes one character forward when the selection is collapsed", () => {
    const session = createRetroLcdEditorSession({
      value: "retro"
    });

    session.moveCursorTo(1);
    const changed = session.deleteForward();

    expect(changed).toBe(true);
    expect(session.getValue()).toBe("rtro");
    expect(session.getSelection()).toEqual({
      start: 1,
      end: 1
    });
  });

  it("replaces the selected text and moves the cursor after the replacement", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display"
    });

    session.setSelection(6, 13);
    const changed = session.replaceSelection("screen");

    expect(changed).toBe(true);
    expect(session.getValue()).toBe("retro screen");
    expect(session.getSelection()).toEqual({
      start: 12,
      end: 12
    });
  });

  it("moves and extends selection by word boundaries", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display tty"
    });

    session.moveCursorTo(0);
    session.moveCursorByWord(1);
    expect(session.getSelection()).toEqual({
      start: 5,
      end: 5
    });

    session.extendSelectionByWord(1);
    expect(session.getSelection()).toEqual({
      start: 5,
      end: 13
    });

    session.extendSelectionByWord(-1);
    expect(session.getSelection()).toEqual({
      start: 5,
      end: 6
    });
  });

  it("selects words at an offset and cuts the selection", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display tty"
    });

    session.selectWordAt(8);
    expect(session.getSelection()).toEqual({
      start: 6,
      end: 13
    });
    expect(session.getSelectedText()).toBe("display");

    const result = session.cutSelection();
    expect(result).toEqual({
      changed: true,
      text: "display"
    });
    expect(session.getValue()).toBe("retro  tty");
    expect(session.getSelection()).toEqual({
      start: 6,
      end: 6
    });
  });

  it("extends selection to document boundaries", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display"
    });

    session.moveCursorTo(5);
    session.extendSelectionToBoundary(-1);
    expect(session.getSelection()).toEqual({
      start: 0,
      end: 5
    });

    session.extendSelectionToBoundary(1);
    expect(session.getSelection()).toEqual({
      start: 5,
      end: 13
    });
  });

  it("does not edit when the session is read only", () => {
    const session = createRetroLcdEditorSession({
      value: "retro display",
      editable: false
    });

    session.setSelection(0, 6);

    expect(session.deleteBackward()).toBe(false);
    expect(session.deleteForward()).toBe(false);
    expect(session.replaceSelection("screen")).toBe(false);
    expect(session.getValue()).toBe("retro display");
    expect(session.getSelection()).toEqual({
      start: 0,
      end: 6
    });
  });

  it("notifies subscribers when the state changes", () => {
    const session = createRetroLcdEditorSession({
      value: "retro"
    });
    let notifications = 0;
    const unsubscribe = session.subscribe(() => {
      notifications += 1;
    });

    session.setSelection(1, 3);
    session.deleteForward();
    unsubscribe();
    session.setPlaceholder("ignored");

    expect(notifications).toBe(2);
  });
});
