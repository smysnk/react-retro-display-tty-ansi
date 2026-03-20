import process from "node:process";
import {
  buildRetroTtyDemoEnv,
  buildRetroTtyDemoShellLaunch,
  createRetroTtyDemoShell
} from "../../scripts/tty-demo-shell.mjs";
import { startTtyWebSocketServer } from "../../scripts/tty-websocket-server.mjs";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const heartbeatMs = Number.parseInt(process.env.HEARTBEAT_MS ?? "15000", 10);
const idleTimeoutMs = Number.parseInt(process.env.IDLE_TIMEOUT_MS ?? "0", 10);
const accessToken = process.env.ACCESS_TOKEN ?? null;
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? null;
const useRetroDemoShell = !/^(0|false|no|off)$/iu.test(process.env.TTY_DEMO_SHELL ?? "true");
const demoShell = useRetroDemoShell ? await createRetroTtyDemoShell({ prefix: "retro-tty-server-" }) : null;
const shellLaunch = demoShell
  ? buildRetroTtyDemoShellLaunch({
      bashRcFile: demoShell.bashRcFile,
      zshRcFile: demoShell.zshRcFile
    })
  : null;
const defaultCwd = process.env.DEFAULT_CWD ?? demoShell?.workDir ?? process.cwd();
const killTerminalOnSocketClose = !/^(0|false|no|off)$/iu.test(
  process.env.KILL_TERMINAL_ON_SOCKET_CLOSE ?? "true"
);
const allowCommandOverride = /^(1|true|yes|on)$/iu.test(
  process.env.ALLOW_COMMAND_OVERRIDE ?? "true"
);
const allowCwdOverride = /^(1|true|yes|on)$/iu.test(
  process.env.ALLOW_CWD_OVERRIDE ?? "true"
);
const allowEnvOverride = /^(1|true|yes|on)$/iu.test(
  process.env.ALLOW_ENV_OVERRIDE ?? "true"
);
const maxPayloadBytes = Number.parseInt(process.env.MAX_PAYLOAD_BYTES ?? "65536", 10);

const server = await startTtyWebSocketServer({
  host,
  port,
  heartbeatMs,
  idleTimeoutMs,
  accessToken,
  allowedOrigin,
  defaultCommand: shellLaunch?.command,
  defaultArgs: shellLaunch?.args,
  defaultCwd,
  defaultEnv: demoShell ? buildRetroTtyDemoEnv({ homeDir: demoShell.homeDir }) : undefined,
  killTerminalOnSocketClose,
  allowCommandOverride,
  allowCwdOverride,
  allowEnvOverride,
  maxPayloadBytes
});

console.log(`TTY websocket server listening on ${server.url}`);

if (demoShell) {
  console.log(`Demo shell prompt ready in ${demoShell.workDir}`);
}

let shuttingDown = false;

const shutdown = async (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await server.close();
  await demoShell?.cleanup();
  process.exit(exitCode);
};

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});
