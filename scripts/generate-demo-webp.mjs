import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "playwright-core";

const rootDir = resolve(new URL("..", import.meta.url).pathname);
const staticDir = resolve(rootDir, "storybook-static");
const outputDir = resolve(rootDir, "docs/assets");
const outputWebpFile = resolve(outputDir, "react-retro-display-tty-ansi.webp");
const outputMp4File = resolve(outputDir, "react-retro-display-tty-ansi.mp4");
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = Number.parseInt(process.env.STORYBOOK_CAPTURE_PORT ?? "6111", 10);
const fps = Number.parseInt(process.env.STORYBOOK_CAPTURE_FPS ?? "14", 10);
const durationMs = Number.parseInt(process.env.STORYBOOK_CAPTURE_DURATION_MS ?? "30000", 10);
const frameCount = Math.max(1, Math.ceil((durationMs / 1000) * fps));

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

const ensureReadable = async (target, label) => {
  try {
    await access(target);
  } catch {
    throw new Error(`${label} not found at ${target}`);
  }
};

const resolveRequestFile = async (requestPath) => {
  const stripped = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = resolve(staticDir, `.${safePath}`);

  if (!candidate.startsWith(staticDir)) {
    throw new Error("Blocked path traversal attempt.");
  }

  const details = await stat(candidate).catch(() => null);

  if (details?.isDirectory()) {
    return resolve(candidate, "index.html");
  }

  if (details?.isFile()) {
    return candidate;
  }

  throw new Error(`Missing asset: ${requestPath}`);
};

const createStaticServer = () =>
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const filePath = await resolveRequestFile(url.pathname);
      const contentType = mimeTypes.get(extname(filePath)) ?? "application/octet-stream";

      response.writeHead(200, { "content-type": contentType });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : "Not found");
    }
  });

const runImg2Webp = async (framesDir) => {
  const duration = Math.max(40, Math.round(1000 / fps));
  const frameFiles = (await readdir(framesDir))
    .filter((file) => file.endsWith(".png"))
    .sort((left, right) => left.localeCompare(right));
  const args = ["-loop", "0", "-kmin", "9", "-kmax", "17", "-mixed"];

  for (const [index, frameFile] of frameFiles.entries()) {
    if (index > 0) {
      args.push("-d", String(duration));
    }

    args.push("-lossy", "-q", "82", "-m", "6", join(framesDir, frameFile));
  }

  args.push("-o", outputWebpFile);

  const result = spawnSync("img2webp", args, {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("img2webp failed to encode the animated webp.");
  }
};

const runFfmpegMp4 = (framesDir) => {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      join(framesDir, "frame-%04d.png"),
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-crf",
      "18",
      outputMp4File
    ],
    {
      cwd: rootDir,
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error("ffmpeg failed to encode the mp4 demo.");
  }
};

const main = async () => {
  await ensureReadable(staticDir, "storybook-static");
  await ensureReadable(chromePath, "Chrome executable");
  await mkdir(outputDir, { recursive: true });

  const frameDir = await mkdtemp(join(tmpdir(), "retro-display-frames-"));
  const server = createStaticServer();
  await new Promise((resolvePromise) => server.listen(port, resolvePromise));

  let browser;

  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true
    });

    const page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 920
      },
      deviceScaleFactor: 1
    });

    await page.goto(
      `http://127.0.0.1:${port}/iframe.html?id=retrolcd--feature-tour&viewMode=story`,
      { waitUntil: "networkidle" }
    );
    await page.waitForSelector("[data-feature-tour-root='true']");
    await page.waitForTimeout(300);

    const target = page.locator("[data-feature-tour-root='true']");

    for (let index = 0; index < frameCount; index += 1) {
      const framePath = join(frameDir, `frame-${String(index).padStart(4, "0")}.png`);
      await target.screenshot({ path: framePath });

      if (index < frameCount - 1) {
        await page.waitForTimeout(1000 / fps);
      }
    }

    await runImg2Webp(frameDir);
    runFfmpegMp4(frameDir);
    const encodedWebp = await stat(outputWebpFile);
    const encodedMp4 = await stat(outputMp4File);
    const generatedFrames = await readdir(frameDir);

    console.log(
      `Created ${outputWebpFile} from ${generatedFrames.length} frames (${Math.round(
        encodedWebp.size / 1024
      )} KB).`
    );
    console.log(
      `Created ${outputMp4File} from ${generatedFrames.length} frames (${Math.round(
        encodedMp4.size / 1024
      )} KB).`
    );
  } finally {
    await browser?.close();
    await new Promise((resolvePromise) => server.close(() => resolvePromise(undefined)));
    await rm(frameDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
