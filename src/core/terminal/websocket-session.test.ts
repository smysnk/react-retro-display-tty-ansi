import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createRetroLcdWebSocketSession,
  type RetroLcdTerminalWebSocketLike
} from "./websocket-session";

class MockWebSocket implements RetroLcdTerminalWebSocketLike {
  static instances: MockWebSocket[] = [];

  readonly sent: string[] = [];
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[]
  ) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({
      code,
      reason,
      wasClean: true
    } as CloseEvent);
  }

  dispatchOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  dispatchMessage(payload: unknown) {
    this.onmessage?.({
      data: JSON.stringify(payload)
    } as MessageEvent<string>);
  }
}

describe("createRetroLcdWebSocketSession", () => {
  beforeEach(() => {
    MockWebSocket.instances.length = 0;
  });

  it("opens with the measured geometry, flushes queued resize updates, and forwards events", () => {
    const session = createRetroLcdWebSocketSession({
      url: "ws://example.test/terminal",
      WebSocket: MockWebSocket,
      openPayload: {
        cwd: "/workspace",
        term: "xterm-256color"
      }
    });
    const events = vi.fn();

    session.subscribe(events);
    session.connect({ rows: 24, cols: 80 });
    session.resize(30, 100);

    expect(session.getState()).toBe("connecting");
    expect(MockWebSocket.instances).toHaveLength(1);

    const socket = MockWebSocket.instances[0]!;
    socket.dispatchOpen();
    socket.dispatchMessage({
      type: "ready",
      pid: 4242
    });
    socket.dispatchMessage({
      type: "data",
      data: "ready\r\n"
    });

    expect(socket.sent.map((entry) => JSON.parse(entry))).toEqual([
      {
        type: "open",
        rows: 30,
        cols: 100,
        cwd: "/workspace",
        term: "xterm-256color"
      }
    ]);
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      { type: "connecting" },
      { type: "open" },
      { type: "ready", pid: 4242 },
      { type: "data", data: "ready\r\n" }
    ]);
    expect(session.getState()).toBe("open");
  });

  it("forwards title and bell events and sends an explicit close message", () => {
    const session = createRetroLcdWebSocketSession({
      url: "ws://example.test/terminal",
      WebSocket: MockWebSocket
    });
    const events = vi.fn();

    session.subscribe(events);
    session.connect({ rows: 24, cols: 80 });

    const socket = MockWebSocket.instances[0]!;
    socket.dispatchOpen();
    socket.dispatchMessage({
      type: "title",
      title: "vim"
    });
    socket.dispatchMessage({
      type: "bell"
    });

    session.close();

    expect(events.mock.calls.map(([event]) => event)).toEqual([
      { type: "connecting" },
      { type: "open" },
      { type: "title", title: "vim" },
      { type: "bell" },
      {
        type: "close",
        code: 1000,
        reason: "Terminal session closed by client.",
        wasClean: true
      }
    ]);
    expect(socket.sent.map((entry) => JSON.parse(entry))).toEqual([
      {
        type: "open",
        rows: 24,
        cols: 80
      },
      {
        type: "close"
      }
    ]);
    expect(session.getState()).toBe("closed");
  });
});
