import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const rootDir = process.cwd();
const matrixPath = resolve(rootDir, "src/core/terminal/conformance/ansi-sequence-matrix.ts");
const reportPath = resolve(rootDir, "docs/ansi-display-support-matrix.md");

const sourceText = await readFile(matrixPath, "utf8");
const sourceFile = ts.createSourceFile(
  matrixPath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS
);

const findExportedConst = (name) => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    const isExported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        return declaration.initializer ?? null;
      }
    }
  }

  throw new Error(`Unable to find exported const ${name} in ${matrixPath}.`);
};

const unwrapExpression = (node) => {
  if (!node) {
    return null;
  }

  if (
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isSatisfiesExpression(node)
  ) {
    return unwrapExpression(node.expression);
  }

  return node;
};

const getProperty = (objectNode, propertyName) =>
  objectNode.properties.find((property) => {
    if (!ts.isPropertyAssignment(property)) {
      return false;
    }

    const propertyNode = property.name;
    return (
      (ts.isIdentifier(propertyNode) && propertyNode.text === propertyName) ||
      (ts.isStringLiteral(propertyNode) && propertyNode.text === propertyName)
    );
  }) ?? null;

const readString = (node) => {
  const unwrapped = unwrapExpression(node);

  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.text;
  }

  throw new Error(`Expected string literal, received ${ts.SyntaxKind[unwrapped.kind]}.`);
};

const readStringArray = (node) => {
  const unwrapped = unwrapExpression(node);
  if (!ts.isArrayLiteralExpression(unwrapped)) {
    throw new Error(`Expected string array, received ${ts.SyntaxKind[unwrapped.kind]}.`);
  }

  return unwrapped.elements.map((element) => readString(element));
};

const readObjectArray = (name) => {
  const initializer = unwrapExpression(findExportedConst(name));
  if (!ts.isArrayLiteralExpression(initializer)) {
    throw new Error(`Expected ${name} to be an array literal.`);
  }

  return initializer.elements.map((element) => {
    const objectNode = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(objectNode)) {
      throw new Error(`Expected ${name} entries to be object literals.`);
    }

    const readOptionalString = (propertyName) => {
      const property = getProperty(objectNode, propertyName);
      return property ? readString(property.initializer) : undefined;
    };

    const readOptionalStringArray = (propertyName) => {
      const property = getProperty(objectNode, propertyName);
      return property ? readStringArray(property.initializer) : undefined;
    };

    return {
      id: readString(getProperty(objectNode, "id").initializer),
      family: readOptionalString("family"),
      description: readOptionalString("description"),
      coverage: readOptionalString("coverage"),
      classification: readOptionalString("classification"),
      status: readOptionalString("status"),
      sequences: readOptionalStringArray("sequences"),
      examples: readOptionalStringArray("examples"),
      caseIds: readOptionalStringArray("caseIds"),
      gapIds: readOptionalStringArray("gapIds"),
      notes: readOptionalString("notes")
    };
  });
};

const supportedCases = readObjectArray("ansiSupportedSequenceCases");
const unsupportedGaps = readObjectArray("ansiSupportGapLedger");
const inventory = readObjectArray("ansiDisplayFacingCommandInventory");

const supportedCaseById = new Map(supportedCases.map((entry) => [entry.id, entry]));
const unsupportedGapById = new Map(unsupportedGaps.map((entry) => [entry.id, entry]));

const statusOrder = [
  "oracle-backed",
  "state-backed",
  "host-facing",
  "deferred",
  "rejected"
];

const statusDescriptions = {
  "oracle-backed": "Verified against xterm-headless fixtures and visible browser playback.",
  "state-backed": "Implemented in parser/buffer state, but still missing some oracle or browser coverage.",
  "host-facing": "Modeled by the parser/runtime, with final visible behavior owned by the host surface.",
  deferred: "Tracked intentionally, but not implemented faithfully yet.",
  rejected: "Explicitly out of scope for the current display-facing terminal surface."
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const toVisibleEscape = (value) =>
  Array.from(value, (character) => {
    switch (character) {
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\b":
        return "\\b";
      case "\t":
        return "\\t";
      case "\f":
        return "\\f";
      case "\u001b":
        return "\\u001b";
      default: {
        const codePoint = character.codePointAt(0) ?? 0;
        if (codePoint < 0x20 || codePoint === 0x7f || codePoint > 0x7e) {
          return codePoint <= 0xffff
            ? `\\u${codePoint.toString(16).padStart(4, "0")}`
            : `\\u{${codePoint.toString(16)}}`;
        }

        return character;
      }
    }
  }).join("");

const formatCode = (value) => `<code>${escapeHtml(value)}</code>`;
const formatSequence = (sequence) => formatCode(toVisibleEscape(sequence));
const formatSequenceList = (sequences = []) => sequences.map((sequence) => formatSequence(sequence)).join(", ");
const formatCodeList = (values = []) => values.map((value) => formatCode(value)).join(", ");
const formatStatusLabel = (status) =>
  status
    .split("-")
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");

const buildCoverageDetail = (entry) => {
  const parts = [];

  if (entry.caseIds?.length) {
    const caseCoverage = Array.from(
      new Set(
        entry.caseIds
          .map((caseId) => supportedCaseById.get(caseId)?.coverage)
          .filter(Boolean)
      )
    );

    if (caseCoverage.length) {
      parts.push(`${caseCoverage.join(", ")} via ${formatCodeList(entry.caseIds)}`);
    }
  }

  if (entry.gapIds?.length) {
    const gapClassifications = Array.from(
      new Set(
        entry.gapIds
          .map((gapId) => unsupportedGapById.get(gapId)?.classification)
          .filter(Boolean)
      )
    );

    if (gapClassifications.length) {
      parts.push(`${gapClassifications.join(", ")} gap ledger via ${formatCodeList(entry.gapIds)}`);
    }
  }

  return parts.join("; ");
};

const buildStatusTable = (status) => {
  const entries = inventory.filter((entry) => entry.status === status);
  if (!entries.length) {
    return "";
  }

  const lines = [
    `## ${formatStatusLabel(status)}`,
    "",
    statusDescriptions[status],
    "",
    "| Family | Sequences | Coverage Source | Notes |",
    "| --- | --- | --- | --- |"
  ];

  for (const entry of entries) {
    lines.push(
      `| ${formatCode(entry.id)} | ${formatSequenceList(entry.sequences)} | ${buildCoverageDetail(entry) || "n/a"} | ${entry.notes ?? entry.description ?? ""} |`
    );
  }

  lines.push("");
  return lines.join("\n");
};

const statusCounts = statusOrder
  .map((status) => [status, inventory.filter((entry) => entry.status === status).length])
  .filter(([, count]) => count > 0);

const deferredFollowUps = inventory.filter((entry) => entry.status === "deferred");

const report = [
  "# ANSI Display Support Matrix",
  "",
  "<!-- This file is generated by scripts/generate-ansi-display-support-report.mjs. -->",
  "",
  "This report is generated from `src/core/terminal/conformance/ansi-sequence-matrix.ts` and reflects the current display-facing ANSI/VT support ledger used by the conformance suite.",
  "",
  "## Summary",
  "",
  `- Total tracked display-facing families: ${inventory.length}`,
  ...statusCounts.map(
    ([status, count]) => `- ${formatStatusLabel(status)}: ${count}`
  ),
  "",
  "Status meanings:",
  "",
  ...statusOrder.map((status) => `- \`${status}\`: ${statusDescriptions[status]}`),
  "",
  ...statusOrder.map((status) => buildStatusTable(status)).filter(Boolean)
];

if (deferredFollowUps.length) {
  report.push(
    "## Deferred Follow-Up Ledger",
    "",
    "These families remain intentionally open and should be treated as the next named fidelity backlog.",
    "",
    "| Family | Deferred Sequences | Gap Ledger |",
    "| --- | --- | --- |"
  );

  for (const entry of deferredFollowUps) {
    const gapDescriptions = (entry.gapIds ?? [])
      .map((gapId) => unsupportedGapById.get(gapId))
      .filter(Boolean)
      .map((gap) => `${formatCode(gap.id)}: ${gap.description}`);

    report.push(
      `| \`${entry.id}\` | ${formatSequenceList(entry.sequences)} | ${gapDescriptions.join("<br/>")} |`
    );
  }

  report.push("");
}

report.push(
  "## Local Verification",
  "",
  "```bash",
  "yarn report:ansi-display",
  "yarn check:ansi-display-report",
  "yarn test:conformance",
  "yarn test:e2e:ansi-display",
  "yarn test:e2e:tty",
  "```",
  ""
);

const nextReport = report.join("\n");
const checkMode = process.argv.includes("--check");

if (checkMode) {
  let existingReport;

  try {
    existingReport = await readFile(reportPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.error(
        "docs/ansi-display-support-matrix.md is missing. Run `yarn report:ansi-display` and commit the generated file."
      );
      process.exit(1);
    }

    throw error;
  }

  if (existingReport !== nextReport) {
    console.error(
      "docs/ansi-display-support-matrix.md is out of date. Run `yarn report:ansi-display`."
    );
    process.exit(1);
  }

  console.log("ANSI display support report is up to date.");
} else {
  await writeFile(reportPath, nextReport, "utf8");
  console.log(`Wrote ${reportPath}`);
}
