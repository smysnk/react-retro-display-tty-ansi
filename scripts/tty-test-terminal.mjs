import process from "node:process";

const ESC = "\u001b";
const BEL = "\u0007";

const write = (value) => {
  process.stdout.write(value);
};

const writeln = (value) => {
  write(`${value}\r\n`);
};

const terminalSize = () => `${process.stdout.columns ?? 0}x${process.stdout.rows ?? 0}`;

let inputBuffer = "";

const consumeLineBreaks = () => {
  while (inputBuffer.startsWith("\r") || inputBuffer.startsWith("\n")) {
    inputBuffer = inputBuffer.slice(1);
  }
};

const handleCommand = (command) => {
  switch (command) {
    case "PING":
      writeln("PONG");
      return;
    case "SIZE?":
      writeln(`SIZE ${terminalSize()}`);
      return;
    case "ALT":
      write(`${ESC}[?1049hALT-SCREEN\r\n`);
      return;
    case "MAIN":
      write(`${ESC}[?1049lPRIMARY\r\n`);
      return;
    case "MOUSEON":
      write(`${ESC}[?1000h${ESC}[?1006hMOUSE ON\r\n`);
      return;
    case "MOUSEOFF":
      write(`${ESC}[?1000l${ESC}[?1006lMOUSE OFF\r\n`);
      return;
    case "FOCUSON":
      write(`${ESC}[?1004hFOCUS ON\r\n`);
      return;
    case "FOCUSOFF":
      write(`${ESC}[?1004lFOCUS OFF\r\n`);
      return;
    case "PASTEON":
      write(`${ESC}[?2004hPASTE ON\r\n`);
      return;
    case "PASTEOFF":
      write(`${ESC}[?2004lPASTE OFF\r\n`);
      return;
    case "BELL":
      write(BEL);
      return;
    case "EXIT":
      writeln("BYE");
      process.exit(0);
      return;
    default:
      if (command.startsWith("TITLE ")) {
        write(`${ESC}]0;${command.slice(6)}${BEL}`);
        return;
      }

      writeln(`ECHO ${command}`);
  }
};

const drainInputBuffer = () => {
  while (inputBuffer.length > 0) {
    if (inputBuffer.startsWith("\u0003")) {
      writeln("INTERRUPT");
      process.exit(0);
      return;
    }

    if (inputBuffer.startsWith(`${ESC}[I`)) {
      writeln("FOCUS IN");
      inputBuffer = inputBuffer.slice(3);
      continue;
    }

    if (inputBuffer.startsWith(`${ESC}[O`)) {
      writeln("FOCUS OUT");
      inputBuffer = inputBuffer.slice(3);
      continue;
    }

    const pasteMatch = inputBuffer.match(/^\u001b\[200~([\s\S]*?)\u001b\[201~/u);
    if (pasteMatch) {
      writeln(`PASTE ${pasteMatch[1]?.replace(/\r?\n/gu, "\\n") ?? ""}`);
      inputBuffer = inputBuffer.slice(pasteMatch[0].length);
      continue;
    }

    const mouseMatch = inputBuffer.match(/^\u001b\[<([0-9;]+[Mm])/u);
    if (mouseMatch) {
      writeln(`MOUSE <${mouseMatch[1] ?? ""}`);
      inputBuffer = inputBuffer.slice(mouseMatch[0].length);
      continue;
    }

    const lineBreakIndex = inputBuffer.search(/[\r\n]/u);
    if (lineBreakIndex === -1) {
      return;
    }

    const command = inputBuffer.slice(0, lineBreakIndex);
    inputBuffer = inputBuffer.slice(lineBreakIndex);
    consumeLineBreaks();

    if (command.length === 0) {
      continue;
    }

    handleCommand(command);
  }
};

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk;
  drainInputBuffer();
});

if (process.stdout.isTTY) {
  process.stdout.on("resize", () => {
    writeln(`RESIZE ${terminalSize()}`);
  });
}

write(`${ESC}]0;Retro TTY Test${BEL}`);
writeln("READY");
