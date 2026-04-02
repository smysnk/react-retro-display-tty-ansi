import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createStorybookBrowserHarness } from "./support/storybook-browser.mjs";
import {
  buildRetroTtyDemoEnv,
  buildRetroTtyDemoShellLaunch,
  createRetroTtyDemoShell,
  RETRO_TTY_PROMPT_TEXT
} from "../scripts/tty-demo-shell.mjs";
import { getNodeTtySupportError } from "../scripts/tty-support.mjs";
import { startTtyWebSocketServer } from "../scripts/tty-websocket-server.mjs";

const harness = createStorybookBrowserHarness({
  viewport: {
    width: 1600,
    height: 1200
  }
});

const page = () => harness.page;
const ttySupportError = getNodeTtySupportError();

const hasCommand = (command) =>
  spawnSync("/bin/sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore"
  }).status === 0;

const terminalAppsUnsupported =
  Boolean(ttySupportError) ||
  !hasCommand("vim") ||
  !hasCommand("less");

const waitForTerminalText = async (fragment, { timeout = 60000 } = {}) => {
  await page().waitForFunction(
    (expected) =>
      (document.querySelector(".retro-screen__body")?.textContent ?? "")
        .replace(/\u00a0/gu, " ")
        .includes(expected),
    fragment,
    { timeout }
  );
};

const readTerminalState = async () =>
  page().locator(".retro-screen").evaluate((root) => ({
    rows: Number(root.getAttribute("data-rows") ?? "0"),
    cols: Number(root.getAttribute("data-cols") ?? "0"),
    text: (root.querySelector(".retro-screen__body")?.textContent ?? "").replace(/\u00a0/gu, " "),
    lines: Array.from(root.querySelectorAll(".retro-screen__line")).map((line) =>
      (line.textContent ?? "").replace(/\u00a0/gu, " ")
    )
  }));

const typeCommand = async (command, { delay = 45 } = {}) => {
  await page().locator(".retro-screen__viewport").focus();
  await page().keyboard.type(command, { delay });
  await page().keyboard.press("Enter");
};

const bootLiveTtyShell = async (t) => {
  const ttyDemoShell = await createRetroTtyDemoShell();
  const launch = buildRetroTtyDemoShellLaunch({
    bashRcFile: ttyDemoShell.bashRcFile,
    zshRcFile: ttyDemoShell.zshRcFile
  });
  const server = await startTtyWebSocketServer({
    port: 0,
    defaultCommand: launch.command,
    defaultArgs: launch.args,
    defaultCwd: ttyDemoShell.workDir,
    allowCommandOverride: false,
    allowCwdOverride: false,
    allowEnvOverride: false,
    defaultEnv: buildRetroTtyDemoEnv({ homeDir: ttyDemoShell.homeDir })
  });

  t.after(async () => {
    await server.close();
    await ttyDemoShell.cleanup();
  });

  await page().addInitScript((config) => {
    window.__RETRO_SCREEN_TTY_DEMO__ = config;
  }, {
    url: server.url,
    openPayload: {
      term: "xterm-256color"
    }
  });

  await harness.gotoStory("retroscreen-capture--live-tty-terminal-bridge-demo");
  await page().waitForSelector('.retro-screen[data-session-state="open"]', {
    timeout: 60_000
  });
  await page().locator(".retro-screen__viewport").click();
  await waitForTerminalText(RETRO_TTY_PROMPT_TEXT);

  return {
    workDir: ttyDemoShell.workDir
  };
};

test(
  "live tty bridge can drive less and keep the pager redraw readable after page navigation",
  { skip: terminalAppsUnsupported },
  async (t) => {
    const { workDir } = await bootLiveTtyShell(t);
    const pagerFile = join(workDir, "pager-demo.txt");
    const pagerLines = Array.from({ length: 80 }, (_, index) =>
      `pager-line-${String(index + 1).padStart(2, "0")}`
    ).join("\n");

    await writeFile(pagerFile, `${pagerLines}\n`, "utf8");
    await typeCommand("less pager-demo.txt");
    await waitForTerminalText("pager-line-01");

    const initialState = await readTerminalState();
    const targetLine = `pager-line-${String(Math.min(80, initialState.rows + 2)).padStart(2, "0")}`;

    await page().keyboard.press("Space");
    await waitForTerminalText(targetLine);

    const pagedState = await readTerminalState();
    assert.ok(
      pagedState.text.includes(targetLine),
      `Expected less to redraw forward far enough to show ${targetLine}.`
    );
    assert.ok(
      !pagedState.text.includes("pager-line-01"),
      "The first page content should no longer dominate the visible pager window after paging forward."
    );

    await page().keyboard.press("q");
    await waitForTerminalText(RETRO_TTY_PROMPT_TEXT);
  }
);

test(
  "live tty bridge can drive vim through alternate-screen startup, insert mode, and quit redraws",
  { skip: terminalAppsUnsupported },
  async (t) => {
    const { workDir } = await bootLiveTtyShell(t);
    const editorFile = join(workDir, "editor-demo.txt");

    await writeFile(editorFile, "alpha\nbeta\n", "utf8");
    await typeCommand("vim -u NONE -N editor-demo.txt");
    await waitForTerminalText("editor-demo.txt");

    await page().keyboard.press("o");
    await waitForTerminalText("-- INSERT --");
    await page().keyboard.type("retro bridge fidelity", { delay: 45 });
    await page().keyboard.press("Escape");
    await waitForTerminalText("retro bridge fidelity");

    const vimState = await readTerminalState();
    assert.ok(
      vimState.text.includes("retro bridge fidelity"),
      "The inserted vim line should remain visible after leaving insert mode."
    );
    assert.ok(
      vimState.text.includes("alpha") || vimState.text.includes("beta"),
      "The original file buffer should remain visible after the vim redraw settles."
    );

    await page().keyboard.type(":q!\n", { delay: 45 });
    await waitForTerminalText(RETRO_TTY_PROMPT_TEXT);

    const shellState = await readTerminalState();
    assert.ok(
      shellState.text.includes(RETRO_TTY_PROMPT_TEXT),
      "Quitting vim should restore the shell prompt on the primary screen."
    );
  }
);
