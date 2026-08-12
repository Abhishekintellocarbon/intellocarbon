import { describe, it, expect } from "vitest";
import {
  CBAM_ANNUAL_DECLARATION_DEADLINE,
  CBAM_FIRST_ANNUAL_DECLARATION_YEAR,
  nextCbamAnnualDeclarationDeadline,
  daysUntil,
  UK_CBAM_ANNUAL_RETURN_DEADLINE,
  UK_CBAM_FIRST_ACCOUNTING_PERIOD_END,
  UK_CBAM_FIRST_ACCOUNTING_PERIOD_START,
  UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR,
  UK_CBAM_FIRST_ANNUAL_RETURN_YEAR,
  nextUkCbamDeadline,
  ukCbamReportingCadence,
} from "../complianceDeadlines";

/**
 * The CBAM annual declaration date drives real outbound behaviour — the 30-day
 * and 7-day warning emails in checkCbamAnnualDeclarationAlert, and the
 * cbamAnnual countdown on the facility dashboard — but nothing asserted it, so
 * moving it silently rescheduled both. These tests pin the date and the
 * clamping behaviour around it.
 *
 * Note: frontend/src/lib/compliance-deadlines.ts mirrors this constant for the
 * marketing homepage and cannot be imported from here. Update it in step.
 */
describe("CBAM annual declaration deadline", () => {
  const at = (iso: string) => new Date(iso);

  it("falls on 31 May", () => {
    expect(CBAM_ANNUAL_DECLARATION_DEADLINE).toEqual({ month: 5, day: 31 });
  });

  it("first applies to the 2027 declaration, covering 2026 imports", () => {
    expect(CBAM_FIRST_ANNUAL_DECLARATION_YEAR).toBe(2027);
  });

  it("clamps to 31 May 2027 for any date before the rule takes effect", () => {
    // 2026 has no real annual declaration, so mid-2026 must look ahead to 2027
    // rather than returning a 2026 date that no exporter actually owes.
    expect(nextCbamAnnualDeclarationDeadline(at("2026-08-03T12:00:00Z")).toISOString()).toBe(
      "2027-05-31T23:59:59.000Z",
    );
    expect(nextCbamAnnualDeclarationDeadline(at("2026-01-01T00:00:00Z")).toISOString()).toBe(
      "2027-05-31T23:59:59.000Z",
    );
  });

  it("returns this year's deadline while it is still ahead", () => {
    expect(nextCbamAnnualDeclarationDeadline(at("2027-05-01T12:00:00Z")).toISOString()).toBe(
      "2027-05-31T23:59:59.000Z",
    );
  });

  it("still returns 31 May during the final day of the window", () => {
    expect(nextCbamAnnualDeclarationDeadline(at("2027-05-31T10:00:00Z")).toISOString()).toBe(
      "2027-05-31T23:59:59.000Z",
    );
  });

  it("rolls to the following year once the deadline has passed", () => {
    expect(nextCbamAnnualDeclarationDeadline(at("2027-06-01T00:00:00Z")).toISOString()).toBe(
      "2028-05-31T23:59:59.000Z",
    );
    expect(nextCbamAnnualDeclarationDeadline(at("2027-12-31T23:00:00Z")).toISOString()).toBe(
      "2028-05-31T23:59:59.000Z",
    );
  });

  it("puts the 30-day and 7-day alerts on the expected calendar dates", () => {
    // checkCbamAnnualDeclarationAlert only fires when daysUntil is exactly 30
    // or 7, so these are the days the warning emails actually go out.
    const deadline = nextCbamAnnualDeclarationDeadline(at("2027-05-01T12:00:00Z"));

    expect(daysUntil(at("2027-05-01T23:59:59Z"), deadline)).toBe(30);
    expect(daysUntil(at("2027-05-24T23:59:59Z"), deadline)).toBe(7);
  });
});

/**
 * UK CBAM is a separate regime with a separate calendar — one annual return
 * for the 2027 accounting period, quarterly from 2028. These pin the dates
 * and the annual->quarterly switchover before any calculation or dashboard
 * code is built on top of them.
 */
describe("UK CBAM calendar", () => {
  const at = (iso: string) => new Date(iso);

  it("runs its first accounting period over calendar 2027", () => {
    expect(UK_CBAM_FIRST_ACCOUNTING_PERIOD_YEAR).toBe(2027);
    expect(UK_CBAM_FIRST_ACCOUNTING_PERIOD_START.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(UK_CBAM_FIRST_ACCOUNTING_PERIOD_END.toISOString()).toBe("2027-12-31T23:59:59.000Z");
  });

  it("falls due 31 May 2028 for that first period", () => {
    expect(UK_CBAM_ANNUAL_RETURN_DEADLINE).toEqual({ month: 5, day: 31 });
    expect(UK_CBAM_FIRST_ANNUAL_RETURN_YEAR).toBe(2028);
  });

  it("reports annually for 2027 and quarterly from 2028", () => {
    expect(ukCbamReportingCadence(2027)).toBe("ANNUAL");
    expect(ukCbamReportingCadence(2028)).toBe("QUARTERLY");
    expect(ukCbamReportingCadence(2029)).toBe("QUARTERLY");
  });

  it("returns the 31 May 2028 return for every date before it", () => {
    expect(nextUkCbamDeadline(at("2026-08-12T12:00:00Z")).toISOString()).toBe("2028-05-31T23:59:59.000Z");
    expect(nextUkCbamDeadline(at("2027-12-31T23:00:00Z")).toISOString()).toBe("2028-05-31T23:59:59.000Z");
    expect(nextUkCbamDeadline(at("2028-05-31T10:00:00Z")).toISOString()).toBe("2028-05-31T23:59:59.000Z");
  });

  it("switches to the EU-style quarter-end deadlines once the first return has passed", () => {
    expect(nextUkCbamDeadline(at("2028-06-01T00:00:00Z")).toISOString()).toBe("2028-07-31T23:59:59.000Z");
    expect(nextUkCbamDeadline(at("2028-11-01T00:00:00Z")).toISOString()).toBe("2029-01-31T23:59:59.000Z");
  });
});
