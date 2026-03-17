export type RetroLcdAnsiParserHandlers = {
  printable: (character: string) => void;
  lineFeed: () => void;
  carriageReturn: () => void;
  backspace: () => void;
  tab: () => void;
  formFeed: () => void;
  bell: () => void;
  cursorUp: (count: number) => void;
  cursorDown: (count: number) => void;
  cursorForward: (count: number) => void;
  cursorBackward: (count: number) => void;
  cursorPosition: (row: number, col: number) => void;
  eraseInDisplay: (mode: number) => void;
  eraseInLine: (mode: number) => void;
  saveCursor: () => void;
  restoreCursor: () => void;
  setGraphicRendition: (params: number[]) => void;
};

type ParserState = "text" | "escape" | "csi";

const isCsiParamCharacter = (character: string) => /[0-9;?]/u.test(character);

const parseParams = (value: string) => {
  if (!value || value === "?") {
    return [];
  }

  return value
    .replace(/\?/gu, "")
    .split(";")
    .map((segment) => {
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
};

const firstParam = (params: number[], fallback = 1) => {
  const value = params[0];
  return value && value > 0 ? value : fallback;
};

export class RetroLcdAnsiParser {
  private state: ParserState = "text";
  private csiParamBuffer = "";

  constructor(private readonly handlers: RetroLcdAnsiParserHandlers) {}

  feed(data: string) {
    for (const character of data) {
      this.feedCharacter(character);
    }
  }

  reset() {
    this.state = "text";
    this.csiParamBuffer = "";
  }

  private feedCharacter(character: string) {
    switch (this.state) {
      case "text":
        this.feedTextCharacter(character);
        return;
      case "escape":
        this.feedEscapeCharacter(character);
        return;
      case "csi":
        this.feedCsiCharacter(character);
        return;
    }
  }

  private feedTextCharacter(character: string) {
    switch (character) {
      case "\u001b":
        this.state = "escape";
        return;
      case "\n":
        this.handlers.lineFeed();
        return;
      case "\r":
        this.handlers.carriageReturn();
        return;
      case "\b":
        this.handlers.backspace();
        return;
      case "\t":
        this.handlers.tab();
        return;
      case "\f":
        this.handlers.formFeed();
        return;
      case "\u0007":
        this.handlers.bell();
        return;
      default:
        this.handlers.printable(character);
    }
  }

  private feedEscapeCharacter(character: string) {
    if (character === "[") {
      this.state = "csi";
      this.csiParamBuffer = "";
      return;
    }

    this.state = "text";
    this.feedTextCharacter(character);
  }

  private feedCsiCharacter(character: string) {
    if (isCsiParamCharacter(character)) {
      this.csiParamBuffer += character;
      return;
    }

    this.dispatchCsi(character, parseParams(this.csiParamBuffer));
    this.state = "text";
    this.csiParamBuffer = "";
  }

  private dispatchCsi(finalByte: string, params: number[]) {
    switch (finalByte) {
      case "A":
        this.handlers.cursorUp(firstParam(params));
        return;
      case "B":
        this.handlers.cursorDown(firstParam(params));
        return;
      case "C":
        this.handlers.cursorForward(firstParam(params));
        return;
      case "D":
        this.handlers.cursorBackward(firstParam(params));
        return;
      case "H":
      case "f":
        this.handlers.cursorPosition(params[0] || 1, params[1] || 1);
        return;
      case "J":
        this.handlers.eraseInDisplay(params[0] ?? 0);
        return;
      case "K":
        this.handlers.eraseInLine(params[0] ?? 0);
        return;
      case "s":
        this.handlers.saveCursor();
        return;
      case "u":
        this.handlers.restoreCursor();
        return;
      case "m":
        this.handlers.setGraphicRendition(params);
        return;
      default:
        return;
    }
  }
}
