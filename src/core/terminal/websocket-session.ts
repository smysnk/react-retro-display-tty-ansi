import type {
  RetroScreenTerminalSession,
  RetroScreenTerminalSessionEvent,
  RetroScreenTerminalSessionGeometry,
  RetroScreenTerminalSessionListener,
  RetroScreenTerminalSessionState
} from "./session-types";

type RetroScreenTerminalClientMessage =
  | {
      type: "open";
      rows: number;
      cols: number;
      cwd?: string;
      env?: Record<string, string>;
      command?: string;
      args?: string[];
      term?: string;
    }
  | {
      type: "input";
      data: string;
      encoding: "utf8" | "base64";
    }
  | {
      type: "resize";
      rows: number;
      cols: number;
    }
  | {
      type: "close";
    };

type RetroScreenTerminalServerMessage =
  | { type: "ready"; pid?: number | null }
  | { type: "data"; data: string }
  | { type: "title"; title: string }
  | { type: "bell" }
  | { type: "exit"; exitCode: number | null; signal: string | null }
  | { type: "error"; message: string };

export type RetroScreenTerminalWebSocketLike = {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

export type RetroScreenTerminalWebSocketConstructor = new (
  url: string,
  protocols?: string | string[]
) => RetroScreenTerminalWebSocketLike;

export type RetroScreenTerminalWebSocketSessionOptions = {
  url: string | URL;
  protocols?: string | string[];
  WebSocket?: RetroScreenTerminalWebSocketConstructor;
  openPayload?:
    | Omit<Extract<RetroScreenTerminalClientMessage, { type: "open" }>, "type" | "rows" | "cols">
    | ((
        geometry: RetroScreenTerminalSessionGeometry
      ) => Omit<Extract<RetroScreenTerminalClientMessage, { type: "open" }>, "type" | "rows" | "cols">);
};

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const SOCKET_CLOSED = 3;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asBase64 = (value: Uint8Array) => {
  const nodeBuffer = (
    globalThis as typeof globalThis & {
      Buffer?: {
        from: (data: Uint8Array) => { toString: (encoding: "base64") => string };
      };
    }
  ).Buffer;

  if (nodeBuffer) {
    return nodeBuffer.from(value).toString("base64");
  }

  if (typeof globalThis.btoa === "function") {
    let binary = "";
    for (const byte of value) {
      binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
  }

  throw new Error("Base64 encoding is not available in this environment.");
};

const resolveWebSocketConstructor = (
  override?: RetroScreenTerminalWebSocketConstructor
): RetroScreenTerminalWebSocketConstructor => {
  if (override) {
    return override;
  }

  const WebSocketConstructor = (globalThis as typeof globalThis & {
    WebSocket?: RetroScreenTerminalWebSocketConstructor;
  }).WebSocket;

  if (!WebSocketConstructor) {
    throw new Error("WebSocket is not available in this environment.");
  }

  return WebSocketConstructor;
};

const stringifyClientMessage = (message: RetroScreenTerminalClientMessage) => JSON.stringify(message);

const toErrorEvent = (message: string, error?: unknown): RetroScreenTerminalSessionEvent => ({
  type: "error",
  message,
  error
});

export const createRetroScreenWebSocketSession = (
  options: RetroScreenTerminalWebSocketSessionOptions
): RetroScreenTerminalSession => {
  const listeners = new Set<RetroScreenTerminalSessionListener>();
  const WebSocketConstructor = resolveWebSocketConstructor(options.WebSocket);
  const socketUrl = String(options.url);
  let socket: RetroScreenTerminalWebSocketLike | null = null;
  let state: RetroScreenTerminalSessionState = "idle";
  let lastGeometry: RetroScreenTerminalSessionGeometry | null = null;
  let openPayloadSent = false;
  const queuedMessages: string[] = [];

  const emit = (event: RetroScreenTerminalSessionEvent) => {
    if (event.type === "connecting") {
      state = "connecting";
    } else if (event.type === "open" || event.type === "ready") {
      state = "open";
    } else if (event.type === "close" || event.type === "exit") {
      state = "closed";
    } else if (event.type === "error") {
      state = "error";
    }

    for (const listener of listeners) {
      listener(event);
    }
  };

  const sendOrQueue = (message: RetroScreenTerminalClientMessage) => {
    const serialized = stringifyClientMessage(message);

    if (message.type === "resize" && (!socket || socket.readyState === SOCKET_CONNECTING)) {
      return;
    }

    if (!socket || socket.readyState === SOCKET_CONNECTING) {
      queuedMessages.push(serialized);
      return;
    }

    if (socket.readyState === SOCKET_OPEN) {
      socket.send(serialized);
    }
  };

  const flushQueuedMessages = () => {
    if (!socket || socket.readyState !== SOCKET_OPEN) {
      return;
    }

    while (queuedMessages.length > 0) {
      const nextMessage = queuedMessages.shift();
      if (nextMessage) {
        socket.send(nextMessage);
      }
    }
  };

  const sendOpenPayload = () => {
    if (!socket || socket.readyState !== SOCKET_OPEN || !lastGeometry || openPayloadSent) {
      return;
    }

    const extraOpenPayload =
      typeof options.openPayload === "function" ? options.openPayload(lastGeometry) : options.openPayload;

    socket.send(
      stringifyClientMessage({
        type: "open",
        rows: lastGeometry.rows,
        cols: lastGeometry.cols,
        ...extraOpenPayload
      })
    );
    openPayloadSent = true;
    flushQueuedMessages();
  };

  const connect = (geometry: RetroScreenTerminalSessionGeometry) => {
    lastGeometry = geometry;

    if (socket && (socket.readyState === SOCKET_CONNECTING || socket.readyState === SOCKET_OPEN)) {
      return;
    }

    openPayloadSent = false;
    socket = new WebSocketConstructor(socketUrl, options.protocols);
    emit({ type: "connecting" });

    socket.onopen = () => {
      emit({ type: "open" });
      sendOpenPayload();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as RetroScreenTerminalServerMessage | Record<string, unknown>;

        if (!isRecord(payload) || typeof payload.type !== "string") {
          emit(toErrorEvent("Received an invalid terminal session payload.", payload));
          return;
        }

        switch (payload.type) {
          case "ready":
            emit({
              type: "ready",
              pid: typeof payload.pid === "number" ? payload.pid : null
            });
            break;
          case "data":
            emit({
              type: "data",
              data: typeof payload.data === "string" ? payload.data : ""
            });
            break;
          case "title":
            emit({
              type: "title",
              title: typeof payload.title === "string" ? payload.title : ""
            });
            break;
          case "bell":
            emit({ type: "bell" });
            break;
          case "exit":
            emit({
              type: "exit",
              exitCode: typeof payload.exitCode === "number" ? payload.exitCode : null,
              signal: typeof payload.signal === "string" ? payload.signal : null
            });
            break;
          case "error":
            emit({
              type: "error",
              message:
                typeof payload.message === "string"
                  ? payload.message
                  : "Terminal session reported an unknown error."
            });
            break;
          default:
            emit(toErrorEvent(`Received an unknown terminal session event: ${payload.type}`, payload));
        }
      } catch (error) {
        emit(toErrorEvent("Failed to parse a terminal session message.", error));
      }
    };

    socket.onerror = (event) => {
      emit(toErrorEvent("The terminal session websocket encountered an error.", event));
    };

    socket.onclose = (event) => {
      emit({
        type: "close",
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      socket = null;
      openPayloadSent = false;
      queuedMessages.length = 0;
    };
  };

  return {
    connect,
    writeInput(data) {
      const payload =
        typeof data === "string"
          ? {
              type: "input" as const,
              data,
              encoding: "utf8" as const
            }
          : {
              type: "input" as const,
              data: asBase64(data),
              encoding: "base64" as const
            };

      sendOrQueue(payload);
    },
    resize(rows, cols) {
      lastGeometry = { rows, cols };
      sendOrQueue({
        type: "resize",
        rows,
        cols
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      if (!socket || socket.readyState === SOCKET_CLOSED || socket.readyState === SOCKET_CLOSING) {
        return;
      }

      sendOrQueue({ type: "close" });
      socket.close(1000, "Terminal session closed by client.");
    },
    getState() {
      return state;
    }
  };
};
