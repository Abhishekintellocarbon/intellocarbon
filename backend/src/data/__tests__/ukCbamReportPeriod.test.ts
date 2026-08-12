import { describe, it, expect } from "vitest";
import { getUkCbamReportPeriodStatus } from "../complianceDeadlines";

/**
 * The UK filing calendar changes shape partway through: one annual return for
 * the 2027 accounting period, quarterly from 2028. These pin both halves and
 * the handover, since the report-generation window is what actually gates the
 * button and the download endpoint.
 */
describe("UK CBAM report period", () => {
  const at = (iso: string) => new Date(iso);

  it("offers the 2027 annual return, closed, before its window opens", () => {
    const status = getUkCbamReportPeriodStatus(at("2026-08-12T00:00:00Z"));
    expect(status.period).toBe("2027");
    expect(status.isOpen).toBe(false);
    expect(status.windowStart.toISOString()).toBe("2028-01-01T00:00:00.000Z");
    expect(status.windowEnd.toISOString()).toBe("2028-05-31T23:59:59.000Z");
  });

  it("covers the whole of calendar 2027 as the data range", () => {
    const status = getUkCbamReportPeriodStatus(at("2027-06-01T00:00:00Z"));
    expect(status.dataRangeStart?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(status.dataRangeEnd?.toISOString()).toBe("2027-12-31T23:59:59.000Z");
    // Still shut — the period has to close before the return can be filed.
    expect(status.isOpen).toBe(false);
  });

  it("opens once the accounting period closes and stays open to the deadline", () => {
    expect(getUkCbamReportPeriodStatus(at("2028-01-01T09:00:00Z")).isOpen).toBe(true);
    expect(getUkCbamReportPeriodStatus(at("2028-05-31T10:00:00Z")).isOpen).toBe(true);
  });

  it("switches to quarterly periods once the first return has passed", () => {
    const status = getUkCbamReportPeriodStatus(at("2028-07-15T00:00:00Z"));
    expect(status.period).not.toBe("2027");
    expect(status.displayLabel).toMatch(/\(UK\)$/);
  });
});
