import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize, resolve } from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const staticDir = resolve(rootDir, "storybook-static");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
].filter(Boolean);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const wrapTextToColumns = (text, cols, tabWidth = 4) => {
  const lines = [""];
  let col = 0;

  const pushLine = () => {
    lines.push("");
    col = 0;
  };

  const appendChar = (character) => {
    if (col >= cols) {
      pushLine();
    }

    lines[lines.length - 1] += character;
    col += 1;
  };

  for (const character of text) {
    if (character === "\n") {
      pushLine();
      continue;
    }

    if (character === "\r") {
      lines[lines.length - 1] = "";
      col = 0;
      continue;
    }

    if (character === "\t") {
      const spaces = tabWidth - (col % tabWidth || 0);

      for (let index = 0; index < spaces; index += 1) {
        appendChar(" ");
      }

      continue;
    }

    appendChar(character);
  }

  return lines;
};

const getExpectedCursor = ({ value, selectionStart, cols }) => {
  const cursorLines = wrapTextToColumns(value.slice(0, selectionStart), cols);
  let row = cursorLines.length - 1;
  let col = cursorLines[row]?.length ?? 0;

  if (col >= cols) {
    row += 1;
    col = 0;
  }

  return { row, col };
};

const getPreviousCursorCharacter = ({ value, selectionStart, cols }) => {
  if (selectionStart <= 0) {
    return null;
  }

  const lines = wrapTextToColumns(value.slice(0, selectionStart), cols);
  const previous = value[selectionStart - 1];

  if (previous === "\n" || previous === "\r" || previous === "\t") {
    return null;
  }

  return {
    previous,
    lines
  };
};

const createStaticServer = () =>
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const stripped = url.pathname === "/" ? "/index.html" : url.pathname;
      const safePath = normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = resolve(staticDir, `.${safePath}`);

      if (!filePath.startsWith(staticDir)) {
        throw new Error("Blocked path traversal attempt.");
      }

      const details = await stat(filePath);
      const finalPath = details.isDirectory() ? resolve(filePath, "index.html") : filePath;
      const contentType = mimeTypes.get(extname(finalPath)) ?? "application/octet-stream";

      response.writeHead(200, { "content-type": contentType });
      createReadStream(finalPath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Not found");
    }
  });

const detectChromePath = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "No Chrome or Chromium executable was found. Set CHROME_PATH to run the end-to-end tests."
  );
};

let browser;
let page;
let server;
let port;

before(async () => {
  await access(staticDir);
  server = createStaticServer();

  await new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolvePromise(undefined);
    });
  });

  browser = await chromium.launch({
    executablePath: await detectChromePath(),
    headless: true
  });

  page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1100
    }
  });
});

after(async () => {
  await page?.close();
  await browser?.close();

  await new Promise((resolvePromise) => {
    server?.close(() => resolvePromise(undefined));
  });
});

const readCursorState = async () =>
  page.locator(".retro-lcd").evaluate((root) => {
    const input = root.querySelector(".retro-lcd__input");
    const cursor = root.querySelector(".retro-lcd__cursor");

    return {
      cols: Number(root.getAttribute("data-cols")),
      rows: Number(root.getAttribute("data-rows")),
      value: input?.value ?? "",
      selectionStart: input?.selectionStart ?? 0,
      cursorRow: Number(cursor?.style.getPropertyValue("--retro-lcd-cursor-row") ?? -1),
      cursorCol: Number(cursor?.style.getPropertyValue("--retro-lcd-cursor-col") ?? -1),
      lineTexts: Array.from(root.querySelectorAll(".retro-lcd__line")).map((line) =>
        (line.textContent ?? "").replace(/\u00a0/gu, " ")
      )
    };
  });

const assertCursorTracksTypedText = async () => {
  const state = await readCursorState();
  const expected = getExpectedCursor(state);

  assert.ok(state.cols > 0, "The story should report a measured column count.");
  assert.ok(state.rows > 0, "The story should report a measured row count.");
  assert.equal(state.cursorRow, expected.row, "Cursor row should follow typed text.");
  assert.equal(state.cursorCol, expected.col, "Cursor column should follow typed text.");

  const previousCursorCharacter = getPreviousCursorCharacter(state);

  if (!previousCursorCharacter) {
    return;
  }

  const wrappedPrefix = previousCursorCharacter.lines;
  const rowIndex = expected.col === 0 ? expected.row - 1 : expected.row;
  const colIndex = expected.col === 0 ? state.cols - 1 : expected.col - 1;
  const line = wrappedPrefix[rowIndex] ?? "";
  assert.equal(
    line[colIndex],
    previousCursorCharacter.previous,
    "The cursor should render immediately after the most recently typed character."
  );
};

test("editable story keeps the visible cursor after the latest typed character", async () => {
  await page.goto(
    `http://127.0.0.1:${port}/iframe.html?id=retrolcd--editable-notebook&viewMode=story`,
    { waitUntil: "networkidle" }
  );
  await page.locator(".retro-lcd__input").click();

  const initialCols = Number(await page.locator(".retro-lcd").getAttribute("data-cols"));
  const initialSequence = "calm";
  const wrapSequence = "x".repeat(Math.max(1, initialCols + 3 - initialSequence.length));

  for (const character of initialSequence) {
    await page.keyboard.type(character);
    await assertCursorTracksTypedText();
  }

  for (const character of wrapSequence) {
    await page.keyboard.type(character);
    await assertCursorTracksTypedText();
  }

  await page.keyboard.press("Shift+Enter");
  await assertCursorTracksTypedText();

  for (const character of "end") {
    await page.keyboard.type(character);
    await assertCursorTracksTypedText();
  }
});
