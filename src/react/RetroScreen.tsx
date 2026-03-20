import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent
} from "react";
import type { RetroLcdScreenSnapshot } from "../core/terminal/types";
import type { RetroLcdTerminalHostKeyEvent } from "../core/terminal/host-adapter";
import { encodeRetroLcdTerminalInput } from "../core/terminal/input-encoder";
import {
  encodeRetroLcdTerminalMouse,
  type RetroLcdTerminalMouseButton,
  type RetroLcdTerminalMouseEvent
} from "../core/terminal/mouse-encoder";
import {
  encodeRetroLcdTerminalFocusReport,
  encodeRetroLcdTerminalPaste
} from "../core/terminal/paste-encoder";
import type {
  RetroLcdPromptModeProps,
  RetroLcdProps,
  RetroLcdValueModeProps
} from "../core/types";
import { RetroScreenDisplay } from "./RetroScreenDisplay";
import { RetroScreenInputOverlay } from "./RetroScreenInputOverlay";
import { getDisplayModeRootVars } from "./retro-screen-display-color";
import { getDisplayPaddingVars } from "./retro-screen-display-padding";
import { getRetroLcdPointerGridPosition } from "./retro-screen-pointer-grid";
import { useRetroLcdController } from "./useRetroScreenController";
import { useRetroLcdBufferViewport } from "./useRetroScreenBufferViewport";
import { useRetroLcdGeometry } from "./useRetroScreenGeometry";
import { useRetroLcdPromptSession } from "./useRetroScreenPromptSession";
import { useRetroScreenTerminalBridge } from "./useRetroScreenTerminalBridge";
import {
  buildTextRenderModel,
  getValueDisplayText,
  type RetroLcdRenderModel
} from "./retro-screen-render-model";
import { useRetroLcdTerminalRenderModel } from "./useRetroScreenTerminalRenderModel";

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 46;

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(" ");

const clampSelection = (value: number, text: string) =>
  Math.max(0, Math.min(text.length, Number.isFinite(value) ? Math.floor(value) : text.length));

const isMouseTrackingActive = (snapshot: RetroLcdScreenSnapshot) =>
  snapshot.modes.mouseTrackingMode !== "none" && snapshot.modes.mouseProtocol === "sgr";

const toTerminalMouseButton = (button: number): RetroLcdTerminalMouseButton | null => {
  switch (button) {
    case 0:
      return "left";
    case 1:
      return "middle";
    case 2:
      return "right";
    default:
      return null;
  }
};

const toTerminalHostKeyEvent = (
  event: KeyboardEvent<HTMLDivElement>
): RetroLcdTerminalHostKeyEvent => ({
  key: event.key,
  code: event.code,
  altKey: event.altKey,
  ctrlKey: event.ctrlKey,
  metaKey: event.metaKey,
  shiftKey: event.shiftKey,
  repeat: event.repeat
});

export function RetroScreen(props: RetroLcdProps) {
  const displayColorMode = props.displayColorMode ?? "phosphor-green";
  const displaySurfaceMode = props.displaySurfaceMode ?? "dark";
  const requestedCursorMode = props.cursorMode;
  const cursorMode = requestedCursorMode ?? "solid";
  const valueProps = props.mode === "value" ? props : null;
  const terminalProps = props.mode === "terminal" ? props : null;
  const promptProps = props.mode === "prompt" ? props : null;
  const screenRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeMouseButtonRef = useRef<RetroLcdTerminalMouseButton>("none");
  const lastMouseCellRef = useRef<string | null>(null);
  const previousEditableValueRef = useRef(valueProps?.value ?? "");
  const internalTerminalController = useRetroLcdController({
    rows: props.gridMode === "static" ? props.rows : undefined,
    cols: props.gridMode === "static" ? props.cols : undefined,
    scrollback: terminalProps?.bufferSize
  });
  const promptSession = useRetroLcdPromptSession({
    rows: props.gridMode === "static" ? props.rows ?? DEFAULT_ROWS : DEFAULT_ROWS,
    cols: props.gridMode === "static" ? props.cols ?? DEFAULT_COLS : DEFAULT_COLS,
    cursorMode,
    scrollback: promptProps?.bufferSize,
    promptChar: promptProps?.promptChar,
    acceptanceText: promptProps?.acceptanceText,
    rejectionText: promptProps?.rejectionText,
    onCommand: promptProps?.onCommand
  });
  const [focused, setFocused] = useState(Boolean(props.autoFocus));
  const [selectionStart, setSelectionStart] = useState(0);
  const [promptDraft, setPromptDraft] = useState(promptSession.getDraft());
  const [promptSnapshot, setPromptSnapshot] = useState<RetroLcdScreenSnapshot>(() =>
    promptSession.getSnapshot()
  );
  const { geometry, cssVars } = useRetroLcdGeometry({
    screenRef,
    probeRef,
    gridMode: props.gridMode,
    rows: props.rows,
    cols: props.cols,
    onGeometryChange: props.onGeometryChange
  });
  const { snapshot: terminalSnapshot, terminalController } = useRetroLcdTerminalRenderModel({
    terminalProps,
    geometry,
    cursorMode,
    requestedCursorMode,
    internalController: internalTerminalController
  });
  const {
    sessionState,
    sessionTitle,
    sessionBellCount
  } = useRetroScreenTerminalBridge({
    terminalProps,
    geometry,
    terminalController
  });
  const captureTerminalKeyboard =
    terminalProps?.captureKeyboard ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalMouse =
    terminalProps?.captureMouse ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalPaste =
    terminalProps?.capturePaste ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const captureTerminalFocusReport =
    terminalProps?.captureFocusReport ?? Boolean(terminalProps?.session || terminalProps?.onTerminalData);
  const terminalFocusable = terminalProps?.terminalFocusable ?? true;
  const localScrollbackWhenMouseActive = terminalProps?.localScrollbackWhenMouseActive ?? false;
  const bufferViewport = useRetroLcdBufferViewport({
    snapshot: props.mode === "terminal" ? terminalSnapshot : promptSnapshot,
    enabled: props.mode === "terminal" || props.mode === "prompt",
    defaultAutoFollow: terminalProps?.defaultAutoFollow ?? promptProps?.defaultAutoFollow ?? true
  });

  useEffect(() => {
    if (promptProps?.value !== undefined) {
      promptSession.setDraft(promptProps.value);
      promptSession.setSelection(promptProps.value.length);
    }
  }, [promptProps?.value, promptSession]);

  useEffect(() => {
    if (props.autoFocus) {
      if (props.mode === "terminal") {
        if (terminalFocusable) {
          viewportRef.current?.focus();
        }
        return;
      }

      inputRef.current?.focus();
    }
  }, [props.autoFocus, props.mode, terminalFocusable]);

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
    promptSession.resize(geometry.rows, geometry.cols);
    if (requestedCursorMode) {
      promptSession.setCursorMode(requestedCursorMode);
    }
  }, [geometry.cols, geometry.rows, promptSession, requestedCursorMode]);

  useEffect(() => {
    const syncPromptState = () => {
      setPromptSnapshot(promptSession.getSnapshot());
      setPromptDraft(promptSession.getDraft());
    };

    syncPromptState();
    return promptSession.subscribe(syncPromptState);
  }, [promptSession]);

  const renderModel = useMemo<RetroLcdRenderModel>(() => {
    if (props.mode === "terminal") {
      return bufferViewport.renderModel;
    }

    if (promptProps) {
      return bufferViewport.renderModel;
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
    bufferViewport.renderModel,
    focused,
    geometry,
    props.mode,
    selectionStart,
    valueProps
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
    if (props.mode === "terminal") {
      if (terminalFocusable) {
        viewportRef.current?.focus();
      }
      return;
    }

    inputRef.current?.focus();
  };

  const handleBufferNavigationKey = (key: string) => {
    if (props.mode !== "terminal" && props.mode !== "prompt") {
      return false;
    }

    if (props.mode === "prompt" && (key === "Home" || key === "End")) {
      return false;
    }

    return bufferViewport.handleNavigationKey(key);
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
    if (handleBufferNavigationKey(event.key)) {
      event.preventDefault();
      return;
    }

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

  const handleViewportKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal") {
      return;
    }

    if (event.nativeEvent.isComposing || event.key === "Process" || event.key === "Dead") {
      return;
    }

    const terminalKeyEvent = toTerminalHostKeyEvent(event);
    terminalProps?.onTerminalKeyDown?.(terminalKeyEvent);

    if (captureTerminalKeyboard) {
      const encodedInput = encodeRetroLcdTerminalInput(terminalKeyEvent, {
        applicationCursorKeysMode: terminalSnapshot.modes.applicationCursorKeysMode
      });

      if (encodedInput !== null) {
        event.preventDefault();
        emitTerminalData(encodedInput);
        return;
      }
    }

    if (handleBufferNavigationKey(event.key)) {
      event.preventDefault();
    }
  };

  const handleViewportKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal") {
      return;
    }

    terminalProps?.onTerminalKeyUp?.(toTerminalHostKeyEvent(event));
  };

  const emitTerminalData = (data: string | Uint8Array) => {
    terminalProps?.onTerminalData?.(data);
    terminalProps?.session?.writeInput(data);
  };

  const terminalMouseReportingActive =
    props.mode === "terminal" && captureTerminalMouse && isMouseTrackingActive(terminalSnapshot);

  const emitTerminalMouse = (event: RetroLcdTerminalMouseEvent) => {
    if (props.mode !== "terminal") {
      return false;
    }

    const encodedData = encodeRetroLcdTerminalMouse(event, {
      protocol: terminalSnapshot.modes.mouseProtocol,
      trackingMode: terminalSnapshot.modes.mouseTrackingMode
    });
    if (!encodedData) {
      return false;
    }

    terminalProps?.onTerminalMouse?.({
      ...event,
      encodedData
    });
    emitTerminalData(encodedData);
    return true;
  };

  const buildTerminalMouseEvent = (
    event: MouseEvent<HTMLDivElement>,
    action: RetroLcdTerminalMouseEvent["action"],
    button: RetroLcdTerminalMouseButton
  ): RetroLcdTerminalMouseEvent | null => {
    const screenNode = screenRef.current;
    if (!screenNode) {
      return null;
    }

    const { row, col } = getRetroLcdPointerGridPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: screenNode.getBoundingClientRect(),
      geometry
    });

    return {
      action,
      button,
      row,
      col,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  };

  const buildWheelTerminalMouseEvent = (
    event: WheelEvent<HTMLDivElement>
  ): RetroLcdTerminalMouseEvent | null => {
    if (event.deltaY === 0) {
      return null;
    }

    const screenNode = screenRef.current;
    if (!screenNode) {
      return null;
    }

    const { row, col } = getRetroLcdPointerGridPosition({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: screenNode.getBoundingClientRect(),
      geometry
    });

    return {
      action: "wheel",
      button: event.deltaY < 0 ? "wheel-up" : "wheel-down",
      row,
      col,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  };

  const maybeEmitFocusReport = (focusedState: boolean) => {
    if (
      props.mode !== "terminal" ||
      !captureTerminalFocusReport ||
      !terminalSnapshot.modes.focusReportingMode
    ) {
      return;
    }

    emitTerminalData(encodeRetroLcdTerminalFocusReport(focusedState));
  };

  const handleViewportPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (props.mode !== "terminal" || !captureTerminalPaste) {
      return;
    }

    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText) {
      return;
    }

    event.preventDefault();
    emitTerminalData(
      encodeRetroLcdTerminalPaste(pastedText, {
        bracketedPasteMode: terminalSnapshot.modes.bracketedPasteMode
      })
    );
  };

  const handleViewportMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (!terminalMouseReportingActive) {
      return;
    }

    const button = toTerminalMouseButton(event.button);
    if (!button) {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "press", button);
    if (!mouseEvent) {
      return;
    }

    activeMouseButtonRef.current = button;
    lastMouseCellRef.current = `${mouseEvent.row}:${mouseEvent.col}:${button}`;
    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!terminalMouseReportingActive) {
      return;
    }

    const activeButton = activeMouseButtonRef.current;
    const button =
      activeButton !== "none"
        ? activeButton
        : terminalSnapshot.modes.mouseTrackingMode === "any"
          ? "none"
          : null;
    if (!button) {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "move", button);
    if (!mouseEvent) {
      return;
    }

    const cellKey = `${mouseEvent.row}:${mouseEvent.col}:${button}`;
    if (cellKey === lastMouseCellRef.current) {
      return;
    }

    lastMouseCellRef.current = cellKey;
    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    if (!terminalMouseReportingActive) {
      activeMouseButtonRef.current = "none";
      lastMouseCellRef.current = null;
      return;
    }

    const button = toTerminalMouseButton(event.button) ?? activeMouseButtonRef.current;
    if (button === "none") {
      return;
    }

    const mouseEvent = buildTerminalMouseEvent(event, "release", button);
    activeMouseButtonRef.current = "none";
    lastMouseCellRef.current = null;
    if (!mouseEvent) {
      return;
    }

    event.preventDefault();
    emitTerminalMouse(mouseEvent);
  };

  const handleViewportContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (terminalMouseReportingActive) {
      event.preventDefault();
    }
  };

  const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (
      props.mode === "terminal" &&
      terminalMouseReportingActive &&
      !localScrollbackWhenMouseActive
    ) {
      const mouseEvent = buildWheelTerminalMouseEvent(event);
      if (mouseEvent && emitTerminalMouse(mouseEvent)) {
        event.preventDefault();
      }
      return;
    }

    if (
      (props.mode === "terminal" || props.mode === "prompt") &&
      bufferViewport.handleWheelDelta(event.deltaY)
    ) {
      event.preventDefault();
    }
  };

  const inlineStyle = {
    "--retro-lcd-rows": `${geometry.rows}`,
    "--retro-lcd-cols": `${geometry.cols}`,
    ...getDisplayModeRootVars(displayColorMode, displaySurfaceMode, props.color),
    ...getDisplayPaddingVars(props.displayPadding),
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
      data-grid-mode={props.gridMode ?? "auto"}
      data-display-color-mode={displayColorMode}
      data-display-surface-mode={displaySurfaceMode}
      data-placeholder={renderModel.isDimmed ? "true" : "false"}
      data-buffer-offset={bufferViewport.viewportState.scrollOffset}
      data-buffer-max-offset={bufferViewport.viewportState.maxScrollOffset}
      data-auto-follow={bufferViewport.viewportState.autoFollow ? "true" : "false"}
      data-terminal-mouse-tracking={props.mode === "terminal" ? terminalSnapshot.modes.mouseTrackingMode : undefined}
      data-terminal-mouse-protocol={props.mode === "terminal" ? terminalSnapshot.modes.mouseProtocol : undefined}
      data-terminal-alternate-screen={
        props.mode === "terminal" ? (terminalSnapshot.modes.alternateScreenBufferMode ? "true" : "false") : undefined
      }
      data-session-state={props.mode === "terminal" ? sessionState : undefined}
      data-session-title={props.mode === "terminal" ? sessionTitle ?? undefined : undefined}
      data-session-bell-count={props.mode === "terminal" ? String(sessionBellCount) : undefined}
    >
      <div className="retro-lcd__bezel" aria-hidden="true" />
      <RetroScreenDisplay
        mode={props.mode}
        renderModel={renderModel}
        displayColorMode={displayColorMode}
        displaySurfaceMode={displaySurfaceMode}
        screenRef={screenRef}
        probeRef={probeRef}
        viewportRef={viewportRef}
        onViewportClick={focusInput}
        onViewportFocus={
          props.mode === "terminal"
            ? () => {
                setFocused(true);
                maybeEmitFocusReport(true);
                props.onFocusChange?.(true);
              }
            : undefined
        }
        onViewportBlur={
          props.mode === "terminal"
            ? () => {
                setFocused(false);
                maybeEmitFocusReport(false);
                props.onFocusChange?.(false);
              }
            : undefined
        }
        onViewportPaste={props.mode === "terminal" ? handleViewportPaste : undefined}
        onViewportKeyDown={handleViewportKeyDown}
        onViewportKeyUp={handleViewportKeyUp}
        onViewportMouseDown={props.mode === "terminal" ? handleViewportMouseDown : undefined}
        onViewportMouseMove={props.mode === "terminal" ? handleViewportMouseMove : undefined}
        onViewportMouseUp={props.mode === "terminal" ? handleViewportMouseUp : undefined}
        onViewportContextMenu={props.mode === "terminal" ? handleViewportContextMenu : undefined}
        onViewportWheel={handleViewportWheel}
        viewportTabIndex={props.mode === "terminal" && terminalFocusable ? 0 : undefined}
      >
        <RetroScreenInputOverlay
          inputRef={inputRef}
          visible={props.mode === "prompt" || (props.mode === "value" && Boolean(props.editable))}
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
          aria-label={props.mode === "prompt" ? "Retro LCD prompt" : "Retro LCD input"}
        />
      </RetroScreenDisplay>
    </div>
  );
}

export const RetroLcd = RetroScreen;
