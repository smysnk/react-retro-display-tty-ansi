import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { wrapTextToColumns } from "../core/geometry/wrap";
import { RetroLcdScreenBuffer } from "../core/terminal/screen-buffer";
import type { RetroLcdCell, RetroLcdScreenSnapshot } from "../core/terminal/types";
import type {
  CursorMode,
  RetroLcdGeometry,
  RetroLcdPromptModeProps,
  RetroLcdProps,
  RetroLcdValueModeProps
} from "../core/types";
import { useRetroLcdController } from "./useRetroLcdController";
import { useRetroLcdGeometry } from "./useRetroLcdGeometry";
import { useRetroLcdPromptSession } from "./useRetroLcdPromptSession";

const DEFAULT_COLOR = "#97ff9b";
const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 46;

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

type RetroLcdCursorRenderState = {
  row: number;
  col: number;
  mode: CursorMode;
};

type RetroLcdRenderModel = {
  lines: string[];
  cells?: RetroLcdCell[][];
  cursor: RetroLcdCursorRenderState | null;
  isDimmed: boolean;
};

const createBlankLines = (rows: number) => Array.from({ length: rows }, () => "");

const clampSelection = (value: number, text: string) =>
  Math.max(0, Math.min(text.length, Number.isFinite(value) ? Math.floor(value) : text.length));

const normalizeLines = (lines: string[], rows: number) => {
  const nextLines = [...lines];

  while (nextLines.length < rows) {
    nextLines.push("");
  }

  return nextLines.slice(0, rows);
};

const buildTextRenderModel = ({
  text,
  geometry,
  cursorMode,
  cursorOffset,
  cursorVisible,
  dimmed
}: {
  text: string;
  geometry: RetroLcdGeometry;
  cursorMode: CursorMode;
  cursorOffset?: number;
  cursorVisible?: boolean;
  dimmed?: boolean;
}): RetroLcdRenderModel => {
  const wrappedLines = wrapTextToColumns(text, { cols: geometry.cols });
  const totalLines = [...wrappedLines];

  let cursor: RetroLcdCursorRenderState | null = null;
  let windowStart = 0;

  if (cursorVisible) {
    const cursorLines = wrapTextToColumns(text.slice(0, cursorOffset ?? text.length), {
      cols: geometry.cols
    });
    let cursorRow = cursorLines.length - 1;
    let cursorCol = cursorLines[cursorRow]?.length ?? 0;

    if (cursorCol >= geometry.cols) {
      cursorRow += 1;
      cursorCol = 0;
    }

    while (totalLines.length <= cursorRow) {
      totalLines.push("");
    }

    windowStart = Math.min(
      Math.max(0, cursorRow - geometry.rows + 1),
      Math.max(0, totalLines.length - geometry.rows)
    );

    if (cursorRow >= windowStart && cursorRow < windowStart + geometry.rows) {
      cursor = {
        row: cursorRow - windowStart,
        col: cursorCol,
        mode: cursorMode
      };
    }
  } else if (totalLines.length > geometry.rows) {
    windowStart = Math.max(0, totalLines.length - geometry.rows);
  }

  return {
    lines: normalizeLines(totalLines.slice(windowStart, windowStart + geometry.rows), geometry.rows),
    cursor,
    isDimmed: Boolean(dimmed)
  };
};

const buildTerminalSnapshot = ({
  text,
  rows,
  cols,
  cursorMode
}: {
  text: string;
  rows: number;
  cols: number;
  cursorMode: CursorMode;
}): RetroLcdScreenSnapshot => {
  const buffer = new RetroLcdScreenBuffer({
    rows,
    cols,
    cursorMode
  });

  if (text) {
    buffer.write(text);
  }

  return buffer.getSnapshot();
};

const snapshotToRenderModel = (snapshot: RetroLcdScreenSnapshot): RetroLcdRenderModel => ({
  lines: normalizeLines(snapshot.rawLines, snapshot.rows),
  cells: snapshot.cells,
  cursor: snapshot.cursor.visible
    ? {
        row: snapshot.cursor.row,
        col: snapshot.cursor.col,
        mode: snapshot.cursor.mode
      }
    : null,
  isDimmed: false
});

const getValueDisplayText = (props: RetroLcdValueModeProps, focused: boolean) => {
  if (props.value.length > 0) {
    return {
      text: props.value,
      dimmed: false
    };
  }

  return {
    text: props.placeholder && !focused ? props.placeholder : "",
    dimmed: Boolean(props.placeholder && !focused)
  };
};

const getLineDisplayText = (line: string) => (line.length > 0 ? line : "\u00a0");

const getCellCharacter = (cell: RetroLcdCell) => {
  if (cell.style.conceal) {
    return "\u00a0";
  }

  return cell.char === " " ? "\u00a0" : cell.char;
};

const getCellClassName = (cell: RetroLcdCell) =>
  joinClassNames(
    "retro-lcd__cell",
    cell.style.intensity === "bold" ? "retro-lcd__cell--bold" : undefined,
    cell.style.intensity === "faint" ? "retro-lcd__cell--faint" : undefined,
    cell.style.inverse ? "retro-lcd__cell--inverse" : undefined,
    cell.style.conceal ? "retro-lcd__cell--conceal" : undefined,
    cell.style.blink ? "retro-lcd__cell--blink" : undefined
  );

export function RetroLcd(props: RetroLcdProps) {
  const color = props.color || DEFAULT_COLOR;
  const requestedCursorMode = props.cursorMode;
  const cursorMode = requestedCursorMode ?? "solid";
  const valueProps = props.mode === "value" ? props : null;
  const terminalProps = props.mode === "terminal" ? props : null;
  const promptProps = props.mode === "prompt" ? props : null;
  const screenRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const previousEditableValueRef = useRef(valueProps?.value ?? "");
  const internalTerminalController = useRetroLcdController();
  const promptSession = useRetroLcdPromptSession({
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    cursorMode,
    promptChar: promptProps?.promptChar,
    acceptanceText: promptProps?.acceptanceText,
    rejectionText: promptProps?.rejectionText,
    onCommand: promptProps?.onCommand
  });
  const terminalController = terminalProps?.controller ?? (terminalProps ? internalTerminalController : null);
  const [focused, setFocused] = useState(Boolean(props.autoFocus));
  const [selectionStart, setSelectionStart] = useState(0);
  const [terminalSnapshot, setTerminalSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    buildTerminalSnapshot({
      text: terminalProps?.value ?? terminalProps?.initialBuffer ?? "",
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      cursorMode
    })
  );
  const [promptSnapshot, setPromptSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    promptSession.getSnapshot()
  );
  const [promptDraft, setPromptDraft] = useState(promptSession.getDraft());
  const { geometry, cssVars } = useRetroLcdGeometry({
    screenRef,
    probeRef,
    onGeometryChange: props.onGeometryChange
  });

  useEffect(() => {
    if (promptProps?.value !== undefined) {
      promptSession.setDraft(promptProps.value);
      promptSession.setSelection(promptProps.value.length);
    }
  }, [promptProps?.value, promptSession]);

  useEffect(() => {
    if (props.autoFocus) {
      inputRef.current?.focus();
    }
  }, [props.autoFocus]);

  useEffect(() => {
    if (props.mode !== "value" || !valueProps) {
      previousEditableValueRef.current = "";
      return;
    }

    const nextValue = valueProps.value;
    const previousValue = previousEditableValueRef.current;
    previousEditableValueRef.current = nextValue;

    if (!valueProps.editable) {
      return;
    }

    const node = inputRef.current;
    const currentSelection = clampSelection(node?.selectionStart ?? selectionStart, previousValue);
    const appendedAtEnd =
      focused && nextValue.length >= previousValue.length && nextValue.startsWith(previousValue);
    const nextSelection =
      appendedAtEnd && currentSelection === previousValue.length
        ? nextValue.length
        : clampSelection(node?.selectionStart ?? currentSelection, nextValue);

    if (node && document.activeElement === node) {
      node.setSelectionRange(nextSelection, nextSelection);
    }

    setSelectionStart((current) => (current === nextSelection ? current : nextSelection));
  }, [focused, props.mode, selectionStart, valueProps?.editable, valueProps?.value]);

  useEffect(() => {
    if (!terminalController) {
      return;
    }

    terminalController.resize(geometry.rows, geometry.cols);
    if (requestedCursorMode) {
      terminalController.setCursorMode(requestedCursorMode);
    }
  }, [geometry.cols, geometry.rows, requestedCursorMode, terminalController]);

  useEffect(() => {
    promptSession.resize(geometry.rows, geometry.cols);
    if (requestedCursorMode) {
      promptSession.setCursorMode(requestedCursorMode);
    }
  }, [geometry.cols, geometry.rows, promptSession, requestedCursorMode]);

  useEffect(() => {
    if (!terminalProps || terminalProps.controller) {
      return;
    }

    internalTerminalController.reset();
    internalTerminalController.setCursorMode(cursorMode);

    const initialText = terminalProps.value ?? terminalProps.initialBuffer ?? "";
    if (initialText) {
      internalTerminalController.write(initialText);
    }
  }, [cursorMode, internalTerminalController, terminalProps]);

  useEffect(() => {
    if (!terminalController) {
      return;
    }

    const syncSnapshot = () => {
      setTerminalSnapshot(terminalController.getSnapshot());
    };

    syncSnapshot();
    return terminalController.subscribe(syncSnapshot);
  }, [terminalController]);

  useEffect(() => {
    if (props.mode !== "prompt") {
      return;
    }

    const syncPromptState = () => {
      setPromptSnapshot(promptSession.getSnapshot());
      setPromptDraft(promptSession.getDraft());
    };

    syncPromptState();
    return promptSession.subscribe(syncPromptState);
  }, [promptSession, props.mode]);

  const renderModel = useMemo<RetroLcdRenderModel>(() => {
    if (props.mode === "terminal") {
      if (terminalController) {
        return snapshotToRenderModel(terminalSnapshot);
      }

      return snapshotToRenderModel(
        buildTerminalSnapshot({
          text: terminalProps?.value ?? terminalProps?.initialBuffer ?? "",
          rows: geometry.rows,
          cols: geometry.cols,
          cursorMode
        })
      );
    }

    if (promptProps) {
      return snapshotToRenderModel(promptSnapshot);
    }

    const nextValueProps = valueProps as RetroLcdValueModeProps;
    const { text, dimmed } = getValueDisplayText(nextValueProps, focused);
    return buildTextRenderModel({
      text,
      geometry,
      cursorMode,
      cursorVisible: Boolean(valueProps?.editable && focused),
      cursorOffset: selectionStart,
      dimmed
    });
  }, [
    cursorMode,
    focused,
    geometry,
    promptSnapshot,
    props,
    selectionStart,
    terminalController,
    terminalSnapshot
  ]);

  const syncSelection = () => {
    const node = inputRef.current;

    if (!node) {
      return;
    }

    const nextSelection = clampSelection(node.selectionStart ?? node.value.length, node.value);
    if (promptProps) {
      promptSession.setSelection(nextSelection);
      return;
    }

    setSelectionStart(nextSelection);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleValueSubmit = () => {
    if (valueProps) {
      valueProps.onSubmit?.(valueProps.value);
    }
  };

  const handlePromptSubmit = async () => {
    if (!promptProps) {
      return;
    }

    await promptSession.submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    if (props.mode === "value" && event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (props.mode === "prompt") {
      void handlePromptSubmit();
      return;
    }

    handleValueSubmit();
  };

  const handleValueInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!valueProps) {
      return;
    }

    valueProps.onChange?.(event.currentTarget.value);
    syncSelection();
  };

  const handlePromptInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!promptProps) {
      return;
    }

    promptSession.setDraft(event.currentTarget.value);
    const nextSelection = clampSelection(
      event.currentTarget.selectionStart ?? event.currentTarget.value.length,
      event.currentTarget.value
    );
    promptSession.setSelection(nextSelection);
  };

  const inlineStyle = {
    "--retro-lcd-color": color,
    "--retro-lcd-rows": `${geometry.rows}`,
    "--retro-lcd-cols": `${geometry.cols}`,
    ...cssVars,
    ...props.style
  } as CSSProperties;

  return (
    <div
      className={joinClassNames("retro-lcd", props.className)}
      style={inlineStyle}
      data-mode={props.mode}
      data-cursor-mode={renderModel.cursor?.mode ?? cursorMode}
      data-rows={geometry.rows}
      data-cols={geometry.cols}
      data-placeholder={renderModel.isDimmed ? "true" : "false"}
    >
      <div className="retro-lcd__bezel" aria-hidden="true" />
      <div className="retro-lcd__screen">
        <div className="retro-lcd__viewport" onClick={focusInput}>
          <div
            ref={screenRef}
            className={joinClassNames(
              "retro-lcd__grid",
              renderModel.isDimmed ? "retro-lcd__grid--dimmed" : undefined
            )}
          >
            <span ref={probeRef} className="retro-lcd__probe" aria-hidden="true">
              M
            </span>
            <div className="retro-lcd__body" aria-live={props.mode === "terminal" ? "polite" : undefined}>
              {renderModel.cells
                ? renderModel.cells.map((line, rowIndex) => (
                    <div className="retro-lcd__line" key={`cells-${rowIndex}`}>
                      {line.map((cell, colIndex) => (
                        <span
                          className={getCellClassName(cell)}
                          key={`${rowIndex}-${colIndex}-${cell.char}`}
                        >
                          {getCellCharacter(cell)}
                        </span>
                      ))}
                    </div>
                  ))
                : renderModel.lines.map((line, index) => (
                    <div className="retro-lcd__line" key={`${index}-${line}`}>
                      {getLineDisplayText(line)}
                    </div>
                  ))}
            </div>
            {renderModel.cursor ? (
              <div
                className="retro-lcd__cursor"
                data-cursor-mode={renderModel.cursor.mode}
                style={
                  {
                    "--retro-lcd-cursor-row": renderModel.cursor.row,
                    "--retro-lcd-cursor-col": renderModel.cursor.col
                  } as CSSProperties
                }
                aria-hidden="true"
              />
            ) : null}
            {props.mode === "prompt" || (props.mode === "value" && props.editable) ? (
              <textarea
                ref={inputRef}
                className="retro-lcd__input"
                value={promptProps ? promptProps.value ?? promptDraft : valueProps?.value ?? ""}
                onFocus={() => {
                  if (promptProps) {
                    promptSession.setFocused(true);
                    promptSession.setSelection(
                      clampSelection(
                        inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                        inputRef.current?.value ?? ""
                      )
                    );
                  } else {
                    setFocused(true);
                    setSelectionStart(
                      clampSelection(
                        inputRef.current?.selectionStart ?? inputRef.current?.value.length ?? 0,
                        inputRef.current?.value ?? ""
                      )
                    );
                  }
                  props.onFocusChange?.(true);
                }}
                onBlur={() => {
                  if (promptProps) {
                    promptSession.setFocused(false);
                  } else {
                    setFocused(false);
                  }
                  props.onFocusChange?.(false);
                }}
                onSelect={syncSelection}
                onKeyUp={syncSelection}
                onMouseUp={syncSelection}
                onKeyDown={handleKeyDown}
                onInput={props.mode === "prompt" ? handlePromptInput : handleValueInput}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                rows={1}
                aria-label={props.mode === "prompt" ? "Retro LCD prompt" : "Retro LCD input"}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
