import process from "node:process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const RETRO_TTY_PROMPT_TEXT = "operator@retro:~/tty-demo$";
const RETRO_TTY_DEMO_DIRNAME = "tty-demo";

const buildBashPromptScript = () =>
  [
    "export BASH_SILENCE_DEPRECATION_WARNING=1",
    "export PS1='\\[\\e[38;5;119m\\]operator@retro\\[\\e[0m\\]:\\[\\e[38;5;81m\\]\\w\\[\\e[0m\\]$ '",
    "export PROMPT_COMMAND=",
    "export TERM=xterm-256color",
    "export COLORTERM=truecolor",
    "export LANG=C",
    "export LC_ALL=C",
    "export USER=operator",
    "export LOGNAME=operator",
    "set +o vi"
  ].join("\n");

const buildZshPromptScript = () =>
  [
    "export TERM=xterm-256color",
    "export COLORTERM=truecolor",
    "export LANG=C",
    "export LC_ALL=C",
    "export USER=operator",
    "export LOGNAME=operator",
    "export PAGER=cat",
    "export EDITOR=vim",
    "export VISUAL=vim",
    "PROMPT=$'%F{119}operator@retro%f:%F{81}%~%f$ '",
    "RPROMPT=''",
    "PROMPT_EOL_MARK=''",
    "unsetopt PROMPT_SP",
    "unsetopt BEEP"
  ].join("\n");

export const createRetroTtyDemoShell = async ({
  prefix = "retro-tty-demo-"
} = {}) => {
  const homeDir = await mkdtemp(join(tmpdir(), prefix));
  const workDir = join(homeDir, RETRO_TTY_DEMO_DIRNAME);
  const bashRcFile = join(homeDir, ".tty-demo-bashrc");
  const zshRcFile = join(homeDir, ".zshrc");

  await mkdir(workDir, { recursive: true });
  await writeFile(bashRcFile, buildBashPromptScript(), "utf8");
  await writeFile(zshRcFile, buildZshPromptScript(), "utf8");

  return {
    homeDir,
    workDir,
    bashRcFile,
    zshRcFile,
    cleanup: async () => {
      await rm(homeDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100
      });
    }
  };
};

export const buildRetroTtyDemoEnv = ({
  homeDir,
  extraEnv = {}
} = {}) => ({
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  LANG: "C",
  LC_ALL: "C",
  USER: "operator",
  LOGNAME: "operator",
  HOME: homeDir,
  ZDOTDIR: homeDir,
  BASH_SILENCE_DEPRECATION_WARNING: "1",
  PAGER: "cat",
  EDITOR: "vim",
  VISUAL: "vim",
  ...extraEnv
});

export const buildRetroTtyDemoShellLaunch = ({
  bashRcFile,
  zshRcFile
} = {}) => {
  if (process.platform === "win32") {
    return {
      command: process.env.COMSPEC ?? "cmd.exe",
      args: ["/d", "/q"]
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "/bin/zsh",
      args: ["-i"]
    };
  }

  return {
    command: "/bin/bash",
    args: ["--noprofile", "--rcfile", bashRcFile ?? zshRcFile ?? "", "-i"]
  };
};
