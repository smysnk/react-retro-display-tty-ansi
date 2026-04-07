#!/usr/bin/env node

import fs from "node:fs";

const reportPath = process.argv[2] || ".test-results/test-station/report.json";

function main() {
  if (!fs.existsSync(reportPath)) {
    process.stderr.write(`Test-station report not found at ${reportPath}\n`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const summary = report.summary || {};
  const failingPackages = (report.packages || []).filter((pkg) => {
    return pkg?.status === "failed" || Number(pkg?.summary?.failed || 0) > 0;
  });

  const outputLines = [];
  outputLines.push("Test-station detected regressions.");
  outputLines.push(
    `Summary: ${summary.failedPackages ?? 0} failed package(s), ${summary.failedSuites ?? 0} failed suite(s), ${summary.failedTests ?? 0} failed test(s).`,
  );

  if (failingPackages.length === 0) {
    outputLines.push("No failing package details were found in report.json.");
    process.stderr.write(`${outputLines.join("\n")}\n`);
    return;
  }

  let printedTests = 0;
  const maxTestsToPrint = 20;

  for (const pkg of failingPackages) {
    outputLines.push("");
    outputLines.push(`Package: ${pkg.name} (${pkg.location || "unknown location"})`);
    outputLines.push(
      `Package summary: ${pkg.summary?.failed ?? 0} failed, ${pkg.summary?.passed ?? 0} passed, ${pkg.summary?.skipped ?? 0} skipped.`,
    );

    const failingSuites = (pkg.suites || []).filter((suite) => {
      return suite?.status === "failed" || Number(suite?.summary?.failed || 0) > 0;
    });

    if (failingSuites.length === 0) {
      outputLines.push("  No failing suites were listed for this package.");
      continue;
    }

    for (const suite of failingSuites) {
      outputLines.push(`  Suite: ${suite.label}`);
      if (suite.command) {
        outputLines.push(`    Command: ${suite.command}`);
      }
      outputLines.push(
        `    Suite summary: ${suite.summary?.failed ?? 0} failed, ${suite.summary?.passed ?? 0} passed, ${suite.summary?.skipped ?? 0} skipped.`,
      );

      const failingTests = (suite.tests || []).filter((test) => test?.status === "failed");

      if (failingTests.length === 0) {
        outputLines.push("    No failed test entries were listed for this suite.");
        continue;
      }

      for (const test of failingTests) {
        if (printedTests >= maxTestsToPrint) {
          outputLines.push(`    ...additional failed tests omitted after ${maxTestsToPrint} entries.`);
          process.stderr.write(`${outputLines.join("\n")}\n`);
          return;
        }

        outputLines.push(`    Test: ${test.fullName || test.name || "Unnamed test"}`);
        if (test.file) {
          outputLines.push(`      File: ${test.file}`);
        }

        const failureMessages = Array.isArray(test.failureMessages) ? test.failureMessages : [];
        if (failureMessages.length > 0) {
          const firstFailure = String(failureMessages[0]).trim();
          outputLines.push("      Failure:");
          outputLines.push(...firstFailure.split("\n").map((line) => `        ${line}`));
        }

        printedTests += 1;
      }
    }
  }

  process.stderr.write(`${outputLines.join("\n")}\n`);
}

main();
