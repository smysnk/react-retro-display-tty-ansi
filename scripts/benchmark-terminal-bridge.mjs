import process from "node:process";
import { access } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const distEntryPath = resolve(process.cwd(), "dist/index.js");

const buildAnsiLine = (index) => {
  const paletteIndex = 16 + (index % 216);
  const suffix = String(index + 1).padStart(5, "0");
  return `\u001b[38;5;${paletteIndex}mline-${suffix}\u001b[0m  \u001b[2mstatus ok\u001b[0m\r\n`;
};

const measure = (label, fn) => {
  const startedAt = performance.now();
  const result = fn();
  const durationMs = Number((performance.now() - startedAt).toFixed(2));

  return {
    label,
    durationMs,
    ...result
  };
};

try {
  await access(distEntryPath);
} catch {
  console.error("dist/index.js is missing. Run `yarn build` before `yarn perf:terminal`.");
  process.exit(1);
}

const { createRetroScreenController } = await import(pathToFileURL(distEntryPath).href);

const benchmarkRows = 24;
const benchmarkCols = 80;
const subscriber = () => {};

const writeManyBench = measure("writeMany 10k ANSI lines", () => {
  const controller = createRetroScreenController({
    rows: benchmarkRows,
    cols: benchmarkCols,
    scrollback: 12000
  });
  const unsubscribe = controller.subscribe(subscriber);
  const chunks = Array.from({ length: 10000 }, (_, index) => buildAnsiLine(index));

  controller.writeMany(chunks);
  const snapshot = controller.getSnapshot();
  unsubscribe();

  return {
    rows: snapshot.rows.length,
    scrollback: snapshot.scrollback.length
  };
});

const unbatchedBench = measure("write 4k ANSI lines (unbatched)", () => {
  const controller = createRetroScreenController({
    rows: benchmarkRows,
    cols: benchmarkCols,
    scrollback: 6000
  });
  const unsubscribe = controller.subscribe(subscriber);

  for (let index = 0; index < 4000; index += 1) {
    controller.write(buildAnsiLine(index));
  }

  const snapshot = controller.getSnapshot();
  unsubscribe();

  return {
    rows: snapshot.rows.length,
    scrollback: snapshot.scrollback.length
  };
});

const batchedWriteBench = measure("write 4k ANSI lines inside controller.batch", () => {
  const controller = createRetroScreenController({
    rows: benchmarkRows,
    cols: benchmarkCols,
    scrollback: 6000
  });
  const unsubscribe = controller.subscribe(subscriber);

  controller.batch(() => {
    for (let index = 0; index < 4000; index += 1) {
      controller.write(buildAnsiLine(index));
    }
  });

  const snapshot = controller.getSnapshot();
  unsubscribe();

  return {
    rows: snapshot.rows.length,
    scrollback: snapshot.scrollback.length
  };
});

const resizeReplayBench = measure("resize replay after 2k lines", () => {
  const controller = createRetroScreenController({
    rows: benchmarkRows,
    cols: benchmarkCols,
    scrollback: 4000
  });
  const unsubscribe = controller.subscribe(subscriber);

  controller.writeMany(Array.from({ length: 2000 }, (_, index) => buildAnsiLine(index)));

  const sizes = [
    [24, 80],
    [30, 100],
    [18, 60],
    [40, 132],
    [24, 80]
  ];

  for (const [rows, cols] of sizes) {
    controller.resize(rows, cols);
  }

  const snapshot = controller.getSnapshot();
  unsubscribe();

  return {
    rows: snapshot.rows.length,
    scrollback: snapshot.scrollback.length
  };
});

const cachedSnapshotBench = measure("getSnapshot 10k cached reads", () => {
  const controller = createRetroScreenController({
    rows: benchmarkRows,
    cols: benchmarkCols,
    scrollback: 500
  });

  controller.writeMany(Array.from({ length: 250 }, (_, index) => buildAnsiLine(index)));
  controller.getSnapshot();

  let lastRows = 0;

  for (let index = 0; index < 10000; index += 1) {
    lastRows = controller.getSnapshot().rows.length;
  }

  return {
    rows: lastRows
  };
});

const results = [
  writeManyBench,
  unbatchedBench,
  batchedWriteBench,
  resizeReplayBench,
  cachedSnapshotBench
];

const header = ["Scenario", "Duration (ms)", "Visible rows", "Scrollback rows"];
const tableRows = results.map((result) => [
  result.label,
  result.durationMs.toFixed(2),
  String(result.rows ?? "-"),
  String(result.scrollback ?? "-")
]);
const columnWidths = header.map((label, index) =>
  Math.max(label.length, ...tableRows.map((row) => row[index]?.length ?? 0))
);

const formatRow = (row) =>
  row
    .map((value, index) => value.padEnd(columnWidths[index], " "))
    .join("  ");

console.log("RetroScreen terminal benchmark");
console.log(`Node ${process.version} on ${process.platform} ${process.arch}`);
console.log("");
console.log(formatRow(header));
console.log(
  columnWidths
    .map((width) => "-".repeat(width))
    .join("  ")
);

for (const row of tableRows) {
  console.log(formatRow(row));
}
