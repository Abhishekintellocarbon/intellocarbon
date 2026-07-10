import type { Sector } from "@prisma/client";

// Shared between facilityDashboard.service.ts (per-facility) and
// companyDashboard.service.ts (company-wide aggregate) — kept in one place
// so period bucketing/labeling/rounding can't drift between the two.

export const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const quarterLabel = (date: Date): string => `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;

/** Sort key for a quarter label's date — higher is later. */
export const quarterSortKey = (date: Date): number => date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);

export const periodLabel = (start: Date, end: Date): string => {
  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
};

export const seeUnitFor = (sector: Sector): string => (sector === "ELECTRICITY" ? "tCO2e/MWh" : "tCO2e/t");

export type CctsTone = "SURPLUS" | "ON_TRACK" | "DEFICIT" | "NO_TARGET";

/**
 * Green if actual intensity beats target by more than 5%, amber if within
 * 5% either side (roughly on track), red if missing target by more than 5%.
 */
export const cctsTone = (target: number | null, actual: number): CctsTone => {
  if (target == null || target <= 0) return "NO_TARGET";
  const pctDelta = (target - actual) / target;
  if (pctDelta > 0.05) return "SURPLUS";
  if (pctDelta >= -0.05) return "ON_TRACK";
  return "DEFICIT";
};
