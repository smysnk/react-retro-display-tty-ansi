import type { CursorMode } from "../types";
import {
  findRetroScreenNextWordBoundary,
  findRetroScreenPreviousWordBoundary,
  getRetroScreenWordSelectionAtOffset,
  collapseRetroScreenTextSelectionToEnd,
  collapseRetroScreenTextSelectionToStart,
  clampRetroScreenTextOffset,
  createRetroScreenTextSelection,
  deleteRetroScreenSelectedText,
  isRetroScreenTextSelectionCollapsed,
  normalizeRetroScreenTextSelection,
  replaceRetroScreenSelectedText,
  type RetroScreenTextSelection
} from "./selection";

export type RetroScreenEditorSessionOptions = {
  value?: string;
  placeholder?: string;
  editable?: boolean;
  cursorMode?: CursorMode;
  selectionStart?: number;
  selectionEnd?: number;
};

export type RetroScreenEditorSessionState = {
  value: string;
  placeholder: string;
  editable: boolean;
  cursorMode: CursorMode;
  selection: RetroScreenTextSelection;
};

export type RetroScreenEditorSession = {
  setValue: (value: string) => void;
  getValue: () => string;
  setSelection: (start: number, end?: number) => void;
  getSelection: () => RetroScreenTextSelection;
  getSelectedText: () => string;
  moveCursorTo: (offset: number) => void;
  moveCursorByCharacter: (direction: -1 | 1) => void;
  moveCursorByWord: (direction: -1 | 1) => void;
  moveCursorToBoundary: (direction: -1 | 1) => void;
  selectAll: () => void;
  selectWordAt: (offset: number) => void;
  extendSelectionByCharacter: (direction: -1 | 1) => void;
  extendSelectionByWord: (direction: -1 | 1) => void;
  extendSelectionToBoundary: (direction: -1 | 1) => void;
  collapseSelectionToStart: () => void;
  collapseSelectionToEnd: () => void;
  replaceSelection: (text: string) => boolean;
  cutSelection: () => {
    changed: boolean;
    text: string;
  };
  deleteBackward: () => boolean;
  deleteForward: () => boolean;
  setEditable: (editable: boolean) => void;
  isEditable: () => boolean;
  setPlaceholder: (placeholder: string) => void;
  getPlaceholder: () => string;
  setCursorMode: (mode: CursorMode) => void;
  getCursorMode: () => CursorMode;
  getState: () => RetroScreenEditorSessionState;
  subscribe: (listener: () => void) => () => void;
};

const DEFAULT_CURSOR_MODE: CursorMode = "solid";

class RetroScreenEditorSessionStore implements RetroScreenEditorSession {
  private readonly listeners = new Set<() => void>();
  private value: string;
  private placeholder: string;
  private editable: boolean;
  private cursorMode: CursorMode;
  private selectionAnchor: number;
  private selectionFocus: number;

  constructor(options: RetroScreenEditorSessionOptions = {}) {
    this.value = options.value ?? "";
    this.placeholder = options.placeholder ?? "";
    this.editable = options.editable ?? true;
    this.cursorMode = options.cursorMode ?? DEFAULT_CURSOR_MODE;
    const initialSelection = createRetroScreenTextSelection(
      options.selectionStart ?? this.value.length,
      options.selectionEnd ?? options.selectionStart ?? this.value.length,
      this.value.length
    );
    this.selectionAnchor = initialSelection.start;
    this.selectionFocus = initialSelection.end;
  }

  setValue(value: string) {
    if (this.value === value) {
      return;
    }

    this.value = value;
    this.selectionAnchor = clampRetroScreenTextOffset(this.selectionAnchor, this.value.length);
    this.selectionFocus = clampRetroScreenTextOffset(this.selectionFocus, this.value.length);
    this.emit();
  }

  getValue() {
    return this.value;
  }

  setSelection(start: number, end = start) {
    const nextAnchor = clampRetroScreenTextOffset(start, this.value.length);
    const nextFocus = clampRetroScreenTextOffset(end, this.value.length);
    const current = this.getSelection();
    const nextSelection = createRetroScreenTextSelection(nextAnchor, nextFocus, this.value.length);

    if (
      nextSelection.start === current.start &&
      nextSelection.end === current.end &&
      nextAnchor === this.selectionAnchor &&
      nextFocus === this.selectionFocus
    ) {
      return;
    }

    this.selectionAnchor = nextAnchor;
    this.selectionFocus = nextFocus;
    this.emit();
  }

  getSelection() {
    return normalizeRetroScreenTextSelection(
      {
        start: this.selectionAnchor,
        end: this.selectionFocus
      },
      this.value.length
    );
  }

  getSelectedText() {
    const selection = this.getSelection();
    return this.value.slice(selection.start, selection.end);
  }

  moveCursorTo(offset: number) {
    this.setSelection(offset, offset);
  }

  moveCursorByCharacter(direction: -1 | 1) {
    const selection = this.getSelection();
    const nextOffset =
      direction < 0
        ? isRetroScreenTextSelectionCollapsed(selection)
          ? selection.start - 1
          : selection.start
        : isRetroScreenTextSelectionCollapsed(selection)
          ? selection.end + 1
          : selection.end;
    this.moveCursorTo(nextOffset);
  }

  moveCursorByWord(direction: -1 | 1) {
    const selection = this.getSelection();
    const referenceOffset =
      direction < 0
        ? isRetroScreenTextSelectionCollapsed(selection)
          ? selection.start
          : selection.start
        : isRetroScreenTextSelectionCollapsed(selection)
          ? selection.end
          : selection.end;
    const nextOffset =
      direction < 0
        ? findRetroScreenPreviousWordBoundary(this.value, referenceOffset)
        : findRetroScreenNextWordBoundary(this.value, referenceOffset);
    this.moveCursorTo(nextOffset);
  }

  moveCursorToBoundary(direction: -1 | 1) {
    this.moveCursorTo(direction < 0 ? 0 : this.value.length);
  }

  selectAll() {
    this.setSelection(0, this.value.length);
  }

  selectWordAt(offset: number) {
    const selection = getRetroScreenWordSelectionAtOffset(this.value, offset);
    this.setSelection(selection.start, selection.end);
  }

  extendSelectionByCharacter(direction: -1 | 1) {
    const nextFocus = clampRetroScreenTextOffset(this.selectionFocus + direction, this.value.length);
    this.setSelection(this.selectionAnchor, nextFocus);
  }

  extendSelectionByWord(direction: -1 | 1) {
    const nextFocus =
      direction < 0
        ? findRetroScreenPreviousWordBoundary(this.value, this.selectionFocus)
        : findRetroScreenNextWordBoundary(this.value, this.selectionFocus);
    this.setSelection(this.selectionAnchor, nextFocus);
  }

  extendSelectionToBoundary(direction: -1 | 1) {
    this.setSelection(this.selectionAnchor, direction < 0 ? 0 : this.value.length);
  }

  collapseSelectionToStart() {
    const nextSelection = collapseRetroScreenTextSelectionToStart(this.getSelection());

    if (
      nextSelection.start === this.selectionAnchor &&
      nextSelection.end === this.selectionFocus
    ) {
      return;
    }

    this.selectionAnchor = nextSelection.start;
    this.selectionFocus = nextSelection.end;
    this.emit();
  }

  collapseSelectionToEnd() {
    const nextSelection = collapseRetroScreenTextSelectionToEnd(this.getSelection());

    if (
      nextSelection.start === this.selectionAnchor &&
      nextSelection.end === this.selectionFocus
    ) {
      return;
    }

    this.selectionAnchor = nextSelection.start;
    this.selectionFocus = nextSelection.end;
    this.emit();
  }

  replaceSelection(text: string) {
    if (!this.editable) {
      return false;
    }

    const nextState = replaceRetroScreenSelectedText(this.value, this.getSelection(), text);
    this.value = nextState.value;
    this.selectionAnchor = nextState.selection.start;
    this.selectionFocus = nextState.selection.end;
    this.emit();
    return true;
  }

  cutSelection() {
    const text = this.getSelectedText();

    if (!this.editable || text.length === 0) {
      return {
        changed: false,
        text
      };
    }

    const nextState = deleteRetroScreenSelectedText(this.value, this.getSelection());
    this.value = nextState.value;
    this.selectionAnchor = nextState.selection.start;
    this.selectionFocus = nextState.selection.end;
    this.emit();

    return {
      changed: true,
      text
    };
  }

  deleteBackward() {
    if (!this.editable) {
      return false;
    }

    if (!isRetroScreenTextSelectionCollapsed(this.getSelection())) {
      const nextState = deleteRetroScreenSelectedText(this.value, this.getSelection());
      this.value = nextState.value;
      this.selectionAnchor = nextState.selection.start;
      this.selectionFocus = nextState.selection.end;
      this.emit();
      return true;
    }

    if (this.selectionFocus === 0) {
      return false;
    }

    return this.replaceSelectionAtOffsets(this.selectionFocus - 1, this.selectionFocus, "");
  }

  deleteForward() {
    if (!this.editable) {
      return false;
    }

    if (!isRetroScreenTextSelectionCollapsed(this.getSelection())) {
      const nextState = deleteRetroScreenSelectedText(this.value, this.getSelection());
      this.value = nextState.value;
      this.selectionAnchor = nextState.selection.start;
      this.selectionFocus = nextState.selection.end;
      this.emit();
      return true;
    }

    if (this.selectionFocus >= this.value.length) {
      return false;
    }

    return this.replaceSelectionAtOffsets(this.selectionFocus, this.selectionFocus + 1, "");
  }

  setEditable(editable: boolean) {
    if (this.editable === editable) {
      return;
    }

    this.editable = editable;
    this.emit();
  }

  isEditable() {
    return this.editable;
  }

  setPlaceholder(placeholder: string) {
    if (this.placeholder === placeholder) {
      return;
    }

    this.placeholder = placeholder;
    this.emit();
  }

  getPlaceholder() {
    return this.placeholder;
  }

  setCursorMode(mode: CursorMode) {
    if (this.cursorMode === mode) {
      return;
    }

    this.cursorMode = mode;
    this.emit();
  }

  getCursorMode() {
    return this.cursorMode;
  }

  getState(): RetroScreenEditorSessionState {
    return {
      value: this.value,
      placeholder: this.placeholder,
      editable: this.editable,
      cursorMode: this.cursorMode,
      selection: this.getSelection()
    };
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private replaceSelectionAtOffsets(start: number, end: number, replacement: string) {
    const nextState = replaceRetroScreenSelectedText(
      this.value,
      {
        start,
        end
      },
      replacement
    );
    this.value = nextState.value;
    this.selectionAnchor = nextState.selection.start;
    this.selectionFocus = nextState.selection.end;
    this.emit();
    return true;
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const createRetroScreenEditorSession = (
  options: RetroScreenEditorSessionOptions = {}
): RetroScreenEditorSession => new RetroScreenEditorSessionStore(options);
