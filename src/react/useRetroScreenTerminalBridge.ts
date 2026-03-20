import { useEffect, useRef, useState } from "react";
import type {
  RetroLcdController,
  RetroLcdGeometry,
  RetroLcdTerminalModeProps
} from "../core/types";
import type { RetroLcdTerminalSessionState } from "../core/terminal/session-types";

type UseRetroScreenTerminalBridgeArgs = {
  terminalProps: RetroLcdTerminalModeProps | null;
  geometry: RetroLcdGeometry;
  terminalController: RetroLcdController | null;
};

const getGeometrySignature = (rows: number, cols: number) => `${rows}x${cols}`;

export const useRetroScreenTerminalBridge = ({
  terminalProps,
  geometry,
  terminalController
}: UseRetroScreenTerminalBridgeArgs): {
  sessionState: RetroLcdTerminalSessionState;
  sessionTitle: string | null;
  sessionBellCount: number;
} => {
  const session = terminalProps?.session ?? null;
  const onSessionEvent = terminalProps?.onSessionEvent;
  const onSessionStateChange = terminalProps?.onSessionStateChange;
  const closeSessionOnUnmount = terminalProps?.closeSessionOnUnmount ?? true;
  const [sessionState, setSessionState] = useState<RetroLcdTerminalSessionState>(
    session?.getState() ?? "idle"
  );
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [sessionBellCount, setSessionBellCount] = useState(0);
  const lastSentGeometryRef = useRef<string | null>(null);
  const queuedDataChunksRef = useRef<string[]>([]);
  const flushScheduledRef = useRef(false);

  const scheduleQueuedWriteFlush = () => {
    if (!terminalController || flushScheduledRef.current) {
      return;
    }

    flushScheduledRef.current = true;
    queueMicrotask(() => {
      flushScheduledRef.current = false;
      if (!terminalController || queuedDataChunksRef.current.length === 0) {
        return;
      }

      const chunks = queuedDataChunksRef.current;
      queuedDataChunksRef.current = [];
      terminalController.writeMany(chunks);
    });
  };

  useEffect(() => {
    if (!session || !terminalController) {
      setSessionState("idle");
      setSessionTitle(null);
      setSessionBellCount(0);
      lastSentGeometryRef.current = null;
      return;
    }

    const handleStateChange = (nextState: RetroLcdTerminalSessionState) => {
      setSessionState((currentState) => (currentState === nextState ? currentState : nextState));
      onSessionStateChange?.(nextState);
    };

    handleStateChange(session.getState());
    const unsubscribe = session.subscribe((event) => {
      if (event.type === "data") {
        queuedDataChunksRef.current.push(event.data);
        scheduleQueuedWriteFlush();
      } else if (event.type === "title") {
        setSessionTitle((currentTitle) => (currentTitle === event.title ? currentTitle : event.title));
      } else if (event.type === "bell") {
        setSessionBellCount((count) => count + 1);
      }

      if (event.type === "connecting") {
        handleStateChange("connecting");
      } else if (event.type === "open" || event.type === "ready") {
        handleStateChange("open");
      } else if (event.type === "close" || event.type === "exit") {
        handleStateChange("closed");
      } else if (event.type === "error") {
        handleStateChange("error");
      }

      onSessionEvent?.(event);
    });

    session.connect({
      rows: geometry.rows,
      cols: geometry.cols
    });
    lastSentGeometryRef.current = getGeometrySignature(geometry.rows, geometry.cols);

    return () => {
      queuedDataChunksRef.current = [];
      flushScheduledRef.current = false;
      unsubscribe();
      lastSentGeometryRef.current = null;
    };
  }, [
    onSessionEvent,
    onSessionStateChange,
    session,
    terminalController
  ]);

  useEffect(() => {
    if (!session || !terminalController) {
      return;
    }

    const geometrySignature = getGeometrySignature(geometry.rows, geometry.cols);
    if (lastSentGeometryRef.current === geometrySignature) {
      return;
    }

    lastSentGeometryRef.current = geometrySignature;
    session.resize(geometry.rows, geometry.cols);
  }, [geometry.cols, geometry.rows, session, terminalController]);

  useEffect(() => {
    if (!session || !terminalController || !closeSessionOnUnmount) {
      return;
    }

    return () => {
      session.close();
    };
  }, [closeSessionOnUnmount, session, terminalController]);

  return {
    sessionState,
    sessionTitle,
    sessionBellCount
  };
};
