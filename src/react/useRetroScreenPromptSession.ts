import { useEffect, useRef } from "react";
import { createRetroScreenPromptSession } from "../core/terminal/prompt-session";
import type { RetroScreenPromptSessionOptions, RetroScreenPromptSession } from "../core/terminal/prompt-session";

export const useRetroScreenPromptSession = (
  options: RetroScreenPromptSessionOptions = {}
): RetroScreenPromptSession => {
  const sessionRef = useRef<RetroScreenPromptSession | null>(null);

  if (!sessionRef.current) {
    sessionRef.current = createRetroScreenPromptSession(options);
  }

  useEffect(() => {
    sessionRef.current?.updateOptions(options);
  }, [
    options.acceptanceText,
    options.cursorMode,
    options.onCommand,
    options.promptChar,
    options.rejectionText,
    options.scrollback,
    options.tabWidth
  ]);

  useEffect(() => {
    sessionRef.current?.resize(options.rows ?? 9, options.cols ?? 46);
  }, [options.cols, options.rows]);

  return sessionRef.current;
};
