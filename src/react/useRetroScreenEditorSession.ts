import { useEffect, useRef } from "react";
import {
  createRetroScreenEditorSession,
  type RetroScreenEditorSession,
  type RetroScreenEditorSessionOptions
} from "../core/editor/editor-session";

export const useRetroScreenEditorSession = (
  options: RetroScreenEditorSessionOptions = {}
): RetroScreenEditorSession => {
  const sessionRef = useRef<RetroScreenEditorSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = createRetroScreenEditorSession(options);
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
