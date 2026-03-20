import { useEffect, useRef } from "react";
import {
  createRetroLcdEditorSession,
  type RetroLcdEditorSession,
  type RetroLcdEditorSessionOptions
} from "../core/editor/editor-session";

export const useRetroLcdEditorSession = (
  options: RetroLcdEditorSessionOptions = {}
): RetroLcdEditorSession => {
  const sessionRef = useRef<RetroLcdEditorSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = createRetroLcdEditorSession(options);
  }

  useEffect(() => {
    sessionRef.current?.setValue(options.value ?? "");
  }, [options.value]);

  useEffect(() => {
    sessionRef.current?.setPlaceholder(options.placeholder ?? "");
  }, [options.placeholder]);

  useEffect(() => {
    sessionRef.current?.setEditable(options.editable ?? true);
  }, [options.editable]);

  useEffect(() => {
    if (options.cursorMode) {
      sessionRef.current?.setCursorMode(options.cursorMode);
    }
  }, [options.cursorMode]);

  return sessionRef.current;
};
