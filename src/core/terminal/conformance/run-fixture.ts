import { Terminal } from "@xterm/headless";
import { RetroScreenScreenBuffer } from "../screen-buffer";
import {
  formatChunkReproduction,
  resolveChunkRuns,
  shrinkFailingChunks
} from "./chunk-plans";
import { normalizeRetroScreenSnapshot } from "./normalize-retro-lcd";
import { normalizeXtermSnapshot } from "./normalize-xterm";
import { diffNormalizedSnapshots } from "./diff-snapshots";
import type {
  RetroScreenFixtureRunResult,
  RetroScreenTerminalFixture
} from "./types";

const writeToXterm = async (terminal: Terminal, chunks: string[]) => {
  for (const chunk of chunks) {
    await new Promise<void>((resolve) => {
      terminal.write(chunk, () => resolve());
    });
  }
};

const runChunks = async (fixture: RetroScreenTerminalFixture, chunks: string[]) => {
  const buffer = new RetroScreenScreenBuffer({
    rows: fixture.rows,
    cols: fixture.cols,
    scrollback: fixture.scrollback
  });
  const terminal = new Terminal({
    allowProposedApi: true,
    cols: fixture.cols,
    rows: fixture.rows,
    scrollback: fixture.scrollback ?? 200
  });

  for (const chunk of chunks) {
    buffer.write(chunk);
  }

  await writeToXterm(terminal, chunks);

  const retroScreen = normalizeRetroScreenSnapshot(buffer.getSnapshot());
  const xterm = normalizeXtermSnapshot(terminal);

  return {
    retroScreen,
    xterm,
    diffs: diffNormalizedSnapshots(retroScreen, xterm)
  };
};

export const runTerminalFixture = async (
  fixture: RetroScreenTerminalFixture
): Promise<RetroScreenFixtureRunResult[]> => {
  const results: RetroScreenFixtureRunResult[] = [];

  for (const run of resolveChunkRuns(fixture)) {
    let resolvedChunks = run.chunks;
    let outcome = await runChunks(fixture, resolvedChunks);

    if (run.chunkMode === "random" && outcome.diffs.length > 0) {
      resolvedChunks = await shrinkFailingChunks(resolvedChunks, async (candidateChunks) => {
        const candidateResult = await runChunks(fixture, candidateChunks);
        return candidateResult.diffs.length > 0;
      });
      outcome = await runChunks(fixture, resolvedChunks);
    }

    results.push({
      chunkMode: run.chunkMode,
      chunkLabel: run.chunkLabel,
      randomSeed: run.randomSeed,
      resolvedChunks,
      reproduction: formatChunkReproduction(fixture, resolvedChunks),
      fixture,
      retroScreen: outcome.retroScreen,
      xterm: outcome.xterm,
      diffs: outcome.diffs
    });
  }

  return results;
};
