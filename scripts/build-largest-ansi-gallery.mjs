import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const parseArgs = (argv) => {
  const options = {
    count: 200,
    outputRoot: resolve(projectRoot, "public/ansi-gallery"),
    sourceRoot: resolve(projectRoot, "../crawler/ascii")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--count") {
      options.count = Math.max(1, Number.parseInt(argv[index + 1] ?? "200", 10) || 200);
      index += 1;
      continue;
    }

    if (arg === "--output-root") {
      options.outputRoot = resolve(argv[index + 1] ?? options.outputRoot);
      index += 1;
      continue;
    }

    if (arg === "--source-root") {
      options.sourceRoot = resolve(argv[index + 1] ?? options.sourceRoot);
      index += 1;
    }
  }

  return options;
};

const walkZipFiles = (root) => {
  const stack = [root];
  const zipFiles = [];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const nextPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".zip") {
        zipFiles.push(nextPath);
      }
    }
  }

  return zipFiles.sort();
};

const ZIPINFO_ENTRY_PATTERN =
  /^\S+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+\d+\s+\S+\s+\d{2}-[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/;

const listAnsiEntries = (zipPath) => {
  const output = execFileSync("zipinfo", ["-l", zipPath], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  const entries = [];

  for (const line of output.split("\n")) {
    const match = line.match(ZIPINFO_ENTRY_PATTERN);
    if (!match) {
      continue;
    }

    const size = Number.parseInt(match[1] ?? "0", 10);
    const entryName = (match[2] ?? "").trim();

    if (!entryName.toLowerCase().endsWith(".ans")) {
      continue;
    }

    entries.push({
      entryName,
      size,
      zipPath
    });
  }

  return entries;
};

const decodeCp437Byte = (value) =>
  String.fromCodePoint(
    [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
      23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
      44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
      65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85,
      86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105,
      106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
      123, 124, 125, 126, 127, 199, 252, 233, 226, 228, 224, 229, 231, 234, 235, 232, 239,
      238, 236, 196, 197, 201, 230, 198, 244, 246, 242, 251, 249, 255, 214, 220, 162, 163,
      165, 8359, 402, 225, 237, 243, 250, 241, 209, 170, 186, 191, 8976, 172, 189, 188,
      161, 171, 187, 9617, 9618, 9619, 9474, 9508, 9569, 9570, 9558, 9557, 9571, 9553, 9559,
      9565, 9564, 9563, 9488, 9492, 9524, 9516, 9500, 9472, 9532, 9566, 9567, 9562, 9556,
      9577, 9574, 9568, 9552, 9580, 9575, 9576, 9572, 9573, 9561, 9560, 9554, 9555, 9579,
      9578, 9496, 9484, 9608, 9604, 9612, 9616, 9600, 945, 223, 915, 960, 931, 963, 181,
      964, 934, 920, 937, 948, 8734, 966, 949, 8745, 8801, 177, 8805, 8804, 8992, 8993, 247,
      8776, 176, 8729, 183, 8730, 8319, 178, 9632, 160
    ][value] ?? 32
  );

const decodeCp437 = (bytes) => Array.from(bytes, (value) => decodeCp437Byte(value)).join("");

const readSauceText = (bytes, start, length) =>
  decodeCp437(bytes.slice(start, start + length)).replace(/\0+$/u, "").trimEnd();

const findSauceIndex = (bytes) => {
  const signature = new TextEncoder().encode("SAUCE00");

  for (let index = bytes.length - 128; index >= 0; index -= 1) {
    let matches = true;

    for (let offset = 0; offset < signature.length; offset += 1) {
      if (bytes[index + offset] !== signature[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return index;
    }
  }

  return -1;
};

const parseSauce = (bytes) => {
  const sauceIndex = findSauceIndex(bytes);

  if (sauceIndex < 0) {
    return {
      author: "Unknown",
      font: "IBM VGA",
      group: "Unknown",
      height: 25,
      title: "ANSI Stream",
      width: 80
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + sauceIndex, 128);

  return {
    title: readSauceText(bytes, sauceIndex + 7, 35) || "ANSI Stream",
    author: readSauceText(bytes, sauceIndex + 42, 20) || "Unknown",
    group: readSauceText(bytes, sauceIndex + 62, 20) || "Unknown",
    width: view.getUint16(96, true) || 80,
    height: view.getUint16(98, true) || 25,
    font: readSauceText(bytes, sauceIndex + 106, 22) || "IBM VGA"
  };
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const zipFiles = walkZipFiles(options.sourceRoot);
  const ansiEntries = [];

  for (const zipPath of zipFiles) {
    try {
      ansiEntries.push(...listAnsiEntries(zipPath));
    } catch (error) {
      console.warn(`Skipping unreadable zip: ${zipPath}`);
      console.warn(error instanceof Error ? error.message : String(error));
    }
  }

  ansiEntries.sort((left, right) => right.size - left.size);
  const selectedEntries = ansiEntries.slice(0, options.count);

  rmSync(options.outputRoot, { force: true, recursive: true });
  mkdirSync(options.outputRoot, { recursive: true });

  const seenSlugs = new Set();
  const items = [];

  selectedEntries.forEach((entry, index) => {
    const archiveBase = basename(entry.zipPath, ".zip");
    const entryBase = basename(entry.entryName, ".ans");
    let slug = `${String(index + 1).padStart(3, "0")}-${slugify(`${archiveBase}-${entryBase}`)}`;

    while (seenSlugs.has(slug)) {
      slug = `${slug}-x`;
    }

    seenSlugs.add(slug);

    const rawBytes = execFileSync("unzip", ["-p", entry.zipPath, entry.entryName], {
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024
    });
    const bytes = new Uint8Array(rawBytes);
    const gzipBytes = gzipSync(bytes, { level: 9 });
    const sauce = parseSauce(bytes);
    const assetFilename = `${slug}.ans.gz`;

    writeFileSync(join(options.outputRoot, assetFilename), gzipBytes);

    items.push({
      id: slug,
      index: index + 1,
      filename: basename(entry.entryName),
      sourceZipPath: relative(projectRoot, entry.zipPath),
      sourceEntryName: entry.entryName,
      sizeBytes: entry.size,
      gzipSizeBytes: gzipBytes.length,
      width: sauce.width,
      height: sauce.height,
      title: sauce.title,
      author: sauce.author,
      group: sauce.group,
      font: sauce.font,
      url: assetFilename
    });
  });

  writeFileSync(
    join(options.outputRoot, "manifest.json"),
    `${JSON.stringify(
      {
        count: items.length,
        generatedAt: new Date().toISOString(),
        sourceRoot: relative(projectRoot, options.sourceRoot),
        totalSizeBytes: items.reduce((sum, item) => sum + item.sizeBytes, 0),
        totalGzipSizeBytes: items.reduce((sum, item) => sum + item.gzipSizeBytes, 0),
        items
      },
      null,
      2
    )}\n`
  );

  const manifestStats = statSync(join(options.outputRoot, "manifest.json"));

  console.log(
    `Built ANSI gallery with ${items.length} files into ${relative(projectRoot, options.outputRoot)}`
  );
  console.log(
    `Total raw bytes: ${items.reduce((sum, item) => sum + item.sizeBytes, 0).toLocaleString()}`
  );
  console.log(
    `Total gzip bytes: ${items.reduce((sum, item) => sum + item.gzipSizeBytes, 0).toLocaleString()}`
  );
  console.log(`Manifest bytes: ${manifestStats.size.toLocaleString()}`);
}

main();
