import { accessSync, chmodSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import * as pty from "node-pty";

const require = createRequire(import.meta.url);

const resolveProbeCommand = () => {
  if (process.platform === "win32") {
    return {
      command: process.env.COMSPEC ?? "cmd.exe",
      args: ["/d", "/c", "exit 0"]
    };
  }

  return {
    command: process.env.SHELL ?? "/bin/bash",
    args: ["-lc", "exit 0"]
  };
};

const resolveNodeTtyPackageDir = () => {
  const entryPath = require.resolve("node-pty");
  return dirname(dirname(entryPath));
};

const resolveNodeTtySpawnHelperCandidates = () => {
  const packageDir = resolveNodeTtyPackageDir();

  return [
    join(packageDir, "build", "Release", "spawn-helper"),
    join(packageDir, "prebuilds", `${process.platform}-${process.arch}`, "spawn-helper")
  ];
};

export const ensureNodeTtySpawnHelperExecutable = () => {
  if (process.platform !== "darwin") {
    return null;
  }

  for (const helperPath of resolveNodeTtySpawnHelperCandidates()) {
    try {
      accessSync(helperPath, constants.F_OK);
    } catch {
      continue;
    }

    try {
      accessSync(helperPath, constants.X_OK);
      return helperPath;
    } catch {
      chmodSync(helperPath, 0o755);
      return helperPath;
    }
  }

  return null;
};

export const getNodeTtySupportError = () => {
  ensureNodeTtySpawnHelperExecutable();
  const { command, args } = resolveProbeCommand();

  try {
    const probe = pty.spawn(command, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    probe.kill();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

export const hasNodeTtySupport = () => getNodeTtySupportError() === null;
