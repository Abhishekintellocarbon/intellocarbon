import { describe, it, expect } from "vitest";
import {
  currentCctsReportingFyLabel,
  currentQuarterLabel,
  formatDeadline,
  formatLongDeadline,
  getNextComplianceDeadline,
  getNextCctsDeadline,
  indianFyProgressPercent,
} from "../compliance-deadlines";

/**
 * This module is the single source of truth for every deadline the marketing
 * site displays — homepage stat strip and hero badge, the FAQ answer, the CCTS
 * product page. A wrong value here goes straight onto public pages, and the
 * whole point of consolidating was that one fix updates every instance.
 *
 * The dated patterns mirror backend/src/data/complianceDeadlines.ts, which
 * cannot be imported across packages. The "mirrors the backend" block below
 * pins the shared constants so drift between the two shows up as a failure
 * here rather than as two different dates on the site and in the product.
 */
describe("marketing compliance calendar", () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

  describe("getNextComplianceDeadline", () => {
    it("returns the soonest upcoming event with a label and days remaining", () => {
      const next = getNextComplianceDeadline(at("2026-08-03"));

      expect(formatDeadline(next.date)).toBe("1 Oct 2026");
      expect(next.label).toBe("CBAM Q3 report window opens");
      expect(next.daysRemaining).toBe(59);
    });

    it("names the quarter whose data each CBAM window files, not the calendar quarter", () => {
      // The October window files Q3; January files the prior year's Q4.
      expect(getNextComplianceDeadline(at("2026-09-15")).label).toBe("CBAM Q3 report window opens");
      expect(getNextComplianceDeadline(at("2026-12-20")).label).toBe("CBAM Q4 report window opens");
    });

    it("moves to the report deadline once a window has opened", () => {
      const next = getNextComplianceDeadline(at("2027-01-10"));

      expect(formatDeadline(next.date)).toBe("31 Jan 2027");
      expect(next.label).toBe("CBAM Q4 report deadline");
      expect(next.daysRemaining).toBe(21);
    });

    it("crosses the year boundary rather than running out of events", () => {
      expect(formatDeadline(getNextComplianceDeadline(at("2026-12-31")).date)).toBe("1 Jan 2027");
    });

    it("never returns a date in the past", () => {
      // A year of month starts, to catch an off-by-one in any single pattern.
      for (let month = 1; month <= 12; month += 1) {
        const now = at(`2026-${String(month).padStart(2, "0")}-05`);
        const next = getNextComplianceDeadline(now);

        expect(next.date.getTime()).toBeGreaterThan(now.getTime());
        expect(next.daysRemaining).toBeGreaterThanOrEqual(0);
        expect(next.label).not.toBe("");
      }
    });

    it("surfaces the CBAM annual declaration once it is the soonest event", () => {
      const next = getNextComplianceDeadline(at("2027-05-05"));

      expect(formatDeadline(next.date)).toBe("31 May 2027");
      expect(next.label).toBe("CBAM annual declaration due");
    });

    it("has no annual declaration before the rule takes effect", () => {
      // 2026 has no declaration to owe, so May 2026 must not surface one.
      expect(getNextComplianceDeadline(at("2026-05-05")).label).not.toContain("annual declaration");
    });
  });

  describe("getNextCctsDeadline", () => {
    it("pairs the 31 Jul deadline with the FY whose data it covers", () => {
      const ccts = getNextCctsDeadline(at("2026-08-03"));

      expect(formatLongDeadline(ccts.date)).toBe("31 July 2027");
      expect(ccts.fyLabel).toBe("FY2026-27");
    });

    it("still points at this year's deadline while it is ahead", () => {
      const ccts = getNextCctsDeadline(at("2026-04-01"));

      expect(formatLongDeadline(ccts.date)).toBe("31 July 2026");
      expect(ccts.fyLabel).toBe("FY2025-26");
    });
  });

  describe("labels and formatting", () => {
    it("formats short and long forms", () => {
      const date = new Date(Date.UTC(2027, 4, 31, 23, 59, 59));

      expect(formatDeadline(date)).toBe("31 May 2027");
      expect(formatLongDeadline(date)).toBe("31 May 2027");
      // Long form spells the month out where the short form abbreviates it.
      expect(formatDeadline(new Date(Date.UTC(2026, 6, 31)))).toBe("31 Jul 2026");
      expect(formatLongDeadline(new Date(Date.UTC(2026, 6, 31)))).toBe("31 July 2026");
    });

    it("reports the current calendar quarter", () => {
      expect(currentQuarterLabel(at("2026-08-03"))).toBe("Q3 2026");
      expect(currentQuarterLabel(at("2026-01-01"))).toBe("Q1 2026");
      expect(currentQuarterLabel(at("2026-12-31"))).toBe("Q4 2026");
    });

    it("reports the FY that CCTS reporting currently covers", () => {
      // Before 1 Apr the reporting FY has not rolled over yet.
      expect(currentCctsReportingFyLabel(at("2026-08-03"))).toBe("FY2025-26");
      expect(currentCctsReportingFyLabel(at("2027-01-10"))).toBe("FY2025-26");
      expect(currentCctsReportingFyLabel(at("2027-04-02"))).toBe("FY2026-27");
    });
  });

  describe("indianFyProgressPercent", () => {
    it("runs 0 to 100 across the 1 Apr – 31 Mar year", () => {
      expect(indianFyProgressPercent(at("2026-04-01"))).toBe(0);
      expect(indianFyProgressPercent(at("2026-09-30"))).toBeCloseTo(50, -1);
      expect(indianFyProgressPercent(at("2027-03-31"))).toBe(100);
    });

    it("stays within bounds either side of the boundary", () => {
      for (const day of ["2026-04-01", "2026-08-03", "2027-03-30", "2027-04-01"]) {
        const pct = indianFyProgressPercent(at(day));

        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("mirrors the backend compliance calendar", () => {
    // These dates are duplicated from backend/src/data/complianceDeadlines.ts.
    // If one side moves and the other does not, the site and the product will
    // disagree — so pin them here too.
    it("keeps the CBAM annual declaration on 31 May from 2027", () => {
      expect(formatDeadline(getNextComplianceDeadline(at("2027-05-05")).date)).toBe("31 May 2027");
    });

    it("keeps the CCTS deadline on 31 Jul", () => {
      expect(formatLongDeadline(getNextCctsDeadline(at("2026-04-01")).date)).toBe("31 July 2026");
    });

    it("keeps the CBAM quarterly windows on the 1st of Jan/Jul/Oct", () => {
      // March is deliberately absent: the 31 Mar FY close lands first, and the
      // 1 Apr CBAM window coincides with the CCTS window opening the same day,
      // so neither is a clean probe for the quarterly pattern.
      const opens = ["2025-12-20", "2026-06-20", "2026-09-20"].map((day) =>
        formatDeadline(getNextComplianceDeadline(at(day)).date),
      );

      expect(opens).toEqual(["1 Jan 2026", "1 Jul 2026", "1 Oct 2026"]);
    });

    it("closes the CCTS/BRSR annual cycle on 31 Mar", () => {
      const next = getNextComplianceDeadline(at("2026-03-20"));

      expect(formatDeadline(next.date)).toBe("31 Mar 2026");
      expect(next.label).toBe("Next CCTS & BRSR compliance cycle");
    });
  });
});
