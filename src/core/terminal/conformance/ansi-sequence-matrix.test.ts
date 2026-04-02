import { describe, expect, it } from "vitest";
import {
  ansiDisplayFacingCommandInventory,
  ansiSupportGapLedger,
  ansiSupportedSequenceCases
} from "./ansi-sequence-matrix";

const requiredPhaseOneInventoryIds = [
  "csi-cha",
  "csi-vpa",
  "csi-hpa",
  "csi-cnl",
  "csi-cpl",
  "csi-hpr",
  "csi-vpr",
  "csi-ech",
  "csi-rep",
  "tab-stop-management",
  "csi-unmodeled-dec-private-display-modes",
  "charset-designation-and-locking-shifts",
  "c1-eight-bit-controls"
] as const;

describe("ansi sequence matrix", () => {
  it("keeps supported cases, gap rows, and display inventory ids unique", () => {
    const assertUniqueIds = (ids: string[]) => {
      expect(new Set(ids).size).toBe(ids.length);
    };

    assertUniqueIds(ansiSupportedSequenceCases.map((entry) => entry.id));
    assertUniqueIds(ansiSupportGapLedger.map((entry) => entry.id));
    assertUniqueIds(ansiDisplayFacingCommandInventory.map((entry) => entry.id));
  });

  it("classifies every display-facing inventory row explicitly", () => {
    for (const entry of ansiDisplayFacingCommandInventory) {
      expect(entry.status).toBeTruthy();

      if (entry.status === "deferred" || entry.status === "rejected") {
        expect(entry.gapIds?.length ?? 0).toBeGreaterThan(0);
      } else {
        expect(entry.caseIds?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("keeps inventory references aligned with supported cases and gaps", () => {
    const caseIds = new Set(ansiSupportedSequenceCases.map((entry) => entry.id));
    const gapIds = new Set(ansiSupportGapLedger.map((entry) => entry.id));

    for (const entry of ansiDisplayFacingCommandInventory) {
      for (const caseId of entry.caseIds ?? []) {
        expect(caseIds.has(caseId), `Missing supported case ${caseId} for ${entry.id}`).toBe(true);
      }

      for (const gapId of entry.gapIds ?? []) {
        expect(gapIds.has(gapId), `Missing gap row ${gapId} for ${entry.id}`).toBe(true);
      }
    }
  });

  it("tracks every phase 1 display-facing gap family explicitly", () => {
    const inventoryIds = new Set(ansiDisplayFacingCommandInventory.map((entry) => entry.id));

    for (const id of requiredPhaseOneInventoryIds) {
      expect(inventoryIds.has(id), `Missing inventory row for ${id}`).toBe(true);
    }
  });
});
