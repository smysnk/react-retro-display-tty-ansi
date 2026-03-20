import process from "node:process";
import * as pty from "node-pty";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { createTtyOutputParser } from "./tty-output-parser.mjs";
import { ensureNodeTtySpawnHelperExecutable } from "./tty-support.mjs";

const VALID_ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const DEFAULT_MAX_PAYLOAD_BYTES = 64 * 1024;

const normalizeBoolean = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return /^(1|true|yes|on)$/iu.test(String(value));
};

const resolveShell = () => {
  if (process.platform === "win32") {
    return process.env.COMSPEC ?? "powershell.exe";
  }

  return process.env.SHELL ?? "/bin/bash";
};

const sanitizeEnv = (value) => {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const entries = [];

  for (const [key, nextValue] of Object.entries(value)) {
    if (!VALID_ENV_KEY.test(key)) {
      continue;
    }

    entries.push([key, String(nextValue)]);
  }

  return Object.fromEntries(entries);
};

const toPositiveInteger = (value, fallback) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
};

const decodeClientInput = (payload) => {
  if (typeof payload?.data !== "string") {
    return "";
  }

  if (payload.encoding === "base64") {
    return Buffer.from(payload.data, "base64").toString("utf8");
  }

  return payload.data;
};

const safeSend = (socket, payload) => {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
};

const matchesOrigin = (allowedOrigin, request) => {
  if (!allowedOrigin) {
    return true;
  }

  return request.headers.origin === allowedOrigin;
};

const matchesAccessToken = (accessToken, request, payloadToken) => {
  if (!accessToken) {
    return true;
  }

  const requestUrl = new URL(request.url ?? "/", "ws://127.0.0.1");
  return requestUrl.searchParams.get("token") === accessToken || payloadToken === accessToken;
};

export const buildNodeTtyFixtureOpenPayload = ({
  scriptPath,
  args = []
}) => ({
  command: process.execPath,
  args: [scriptPath, ...args],
  term: "xterm-256color"
});

export const startTtyWebSocketServer = async ({
  host = "127.0.0.1",
  port = 0,
  heartbeatMs = 15000,
  idleTimeoutMs = 0,
  accessToken = null,
  allowedOrigin = null,
  killTerminalOnSocketClose = true,
  defaultTerm = "xterm-256color",
  defaultCommand = resolveShell(),
  defaultArgs = [],
  defaultCwd = process.cwd(),
  defaultEnv = {},
  allowCommandOverride = true,
  allowCwdOverride = true,
  allowEnvOverride = true,
  maxPayloadBytes = DEFAULT_MAX_PAYLOAD_BYTES
} = {}) => {
  ensureNodeTtySpawnHelperExecutable();
  const server = createServer();
  const wss = new WebSocketServer({
    server,
    maxPayload: maxPayloadBytes
  });
  const sockets = new Set();

  const heartbeatTimer = typeof window === "undefined" && heartbeatMs > 0
    ? setInterval(() => {
        for (const socket of wss.clients) {
          if (socket.isAlive === false) {
            socket.terminate();
            continue;
          }

          socket.isAlive = false;
          socket.ping();
        }
      }, heartbeatMs)
    : null;

  wss.on("connection", (socket, request) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sockets.add(socket);

    let terminal = null;
    let idleTimer = null;

    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }

      if (idleTimeoutMs > 0) {
        idleTimer = setTimeout(() => {
          safeSend(socket, {
            type: "error",
            message: "TTY websocket session closed after being idle for too long."
          });
          socket.close(1008, "TTY websocket session timed out.");
        }, idleTimeoutMs);
      }
    };

    const cleanupTerminal = () => {
      if (!terminal) {
        return;
      }

      terminal.kill();
      terminal = null;
    };

    const cleanupSocketResources = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const rejectConnection = (message) => {
      safeSend(socket, {
        type: "error",
        message
      });
      socket.close(1008, message);
    };

    if (!matchesOrigin(allowedOrigin, request)) {
      rejectConnection("Origin is not allowed for this TTY websocket server.");
      return;
    }

    resetIdleTimer();

    socket.on("message", (message) => {
      resetIdleTimer();
      let payload;

      try {
        payload = JSON.parse(String(message));
      } catch (error) {
        safeSend(socket, {
          type: "error",
          message: `Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`
        });
        return;
      }

      if (typeof payload?.type !== "string") {
        safeSend(socket, {
          type: "error",
          message: "Missing websocket message type."
        });
        return;
      }

      if (!matchesAccessToken(accessToken, request, payload?.token)) {
        rejectConnection("Access token rejected by the TTY websocket server.");
        return;
      }

      if (payload.type === "open") {
        if (terminal) {
          safeSend(socket, {
            type: "error",
            message: "A TTY session is already active for this websocket."
          });
          return;
        }

        if (!allowCommandOverride && (payload.command !== undefined || payload.args !== undefined)) {
          safeSend(socket, {
            type: "error",
            message: "Command overrides are disabled for this TTY websocket server."
          });
          return;
        }

        if (!allowCwdOverride && payload.cwd !== undefined) {
          safeSend(socket, {
            type: "error",
            message: "Working-directory overrides are disabled for this TTY websocket server."
          });
          return;
        }

        if (!allowEnvOverride && payload.env !== undefined) {
          safeSend(socket, {
            type: "error",
            message: "Environment overrides are disabled for this TTY websocket server."
          });
          return;
        }

        const shell =
          allowCommandOverride &&
          typeof payload.command === "string" &&
          payload.command.length > 0
            ? payload.command
            : defaultCommand;
        const args = allowCommandOverride && Array.isArray(payload.args)
          ? payload.args.map(String)
          : defaultArgs.map(String);
        const cols = Number.isFinite(payload.cols) ? Math.max(1, Math.floor(payload.cols)) : 80;
        const rows = Number.isFinite(payload.rows) ? Math.max(1, Math.floor(payload.rows)) : 24;
        const cwd =
          allowCwdOverride && typeof payload.cwd === "string" && payload.cwd.length > 0
            ? payload.cwd
            : defaultCwd;
        const env = allowEnvOverride ? sanitizeEnv(payload.env) : {};

        try {
          terminal = pty.spawn(shell, args, {
            name:
              typeof payload.term === "string" && payload.term.length > 0 ? payload.term : defaultTerm,
            cols,
            rows,
            cwd,
            env: {
              ...process.env,
              ...sanitizeEnv(defaultEnv),
              ...env
            }
          });
        } catch (error) {
          safeSend(socket, {
            type: "error",
            message: `Failed to start the TTY process: ${error instanceof Error ? error.message : String(error)}`
          });
          return;
        }

        const parseTtyOutput = createTtyOutputParser();

        terminal.onData((data) => {
          const parsed = parseTtyOutput(data);

          if (parsed.data) {
            safeSend(socket, {
              type: "data",
              data: parsed.data
            });
          }

          for (const title of parsed.titles) {
            safeSend(socket, {
              type: "title",
              title
            });
          }

          for (let index = 0; index < parsed.bellCount; index += 1) {
            safeSend(socket, {
              type: "bell"
            });
          }
        });

        terminal.onExit(({ exitCode, signal }) => {
          safeSend(socket, {
            type: "exit",
            exitCode,
            signal: signal === undefined ? null : String(signal)
          });
          cleanupTerminal();
        });

        safeSend(socket, {
          type: "ready",
          pid: terminal.pid
        });
        return;
      }

      if (!terminal) {
        safeSend(socket, {
          type: "error",
          message: "TTY session has not been opened yet."
        });
        return;
      }

      if (payload.type === "resize") {
        const cols = toPositiveInteger(payload.cols, terminal.cols);
        const rows = toPositiveInteger(payload.rows, terminal.rows);
        terminal.resize(cols, rows);
        return;
      }

      if (payload.type === "input") {
        terminal.write(decodeClientInput(payload));
        return;
      }

      if (payload.type === "close") {
        cleanupTerminal();
        return;
      }

      safeSend(socket, {
        type: "error",
        message: `Unsupported websocket message type: ${payload.type}`
      });
    });

    socket.on("close", () => {
      cleanupSocketResources();
      sockets.delete(socket);
      if (killTerminalOnSocketClose) {
        cleanupTerminal();
      }
    });

    socket.on("error", () => {
      cleanupSocketResources();
      if (killTerminalOnSocketClose) {
        cleanupTerminal();
      }
    });
  });

  await new Promise((resolvePromise) => {
    server.listen(port, host, () => resolvePromise(undefined));
  });

  const address = server.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : Number.parseInt(String(port), 10);

  return {
    host,
    port: resolvedPort,
    url: `ws://${host}:${resolvedPort}`,
    server,
    wss,
    async close() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }

      for (const socket of sockets) {
        try {
          socket.close(1001, "TTY websocket server shutting down.");
        } catch {
          socket.terminate();
        }
      }

      const forceTerminateTimer = setTimeout(() => {
        for (const socket of sockets) {
          socket.terminate();
        }
      }, 100);

      forceTerminateTimer.unref?.();

      await new Promise((resolvePromise) => {
        wss.close(() => {
          clearTimeout(forceTerminateTimer);
          server.close(() => resolvePromise(undefined));
        });
      });

      if (sockets.size > 0) {
        for (const socket of sockets) {
          socket.terminate();
        }
      }
    }
  };
};
