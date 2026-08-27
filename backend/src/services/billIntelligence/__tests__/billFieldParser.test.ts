import { describe, it, expect } from "vitest";
import { parseBillFields, normaliseText, OCR_DEMOTION_THRESHOLD } from "../fieldParser";
import { matchDiscom } from "../discomProfiles";
import {
  MSEDCL_HT_INDUSTRIAL,
  TANGEDCO_HT,
  BESCOM_LT_NO_UNIT_TOKEN,
  PVVNL_BILLING_MONTH_ONLY,
  TORRENT_KVAH_ONLY,
  CONFLICTING_UNITS,
  AMBIGUOUS_DATE_ORDER,
  UNKNOWN_DISCOM,
  NOT_A_BILL,
  ALL_FIXTURES,
} from "./billFixtures";

/**
 * The property under test throughout is not "the parser fills fields in" — it
 * is "the parser never puts a number on screen that isn't on the bill". Most
 * of these cases therefore assert a *null* plus a stated reason, because on a
 * feature that pre-fills a regulated emissions figure, a confidently wrong
 * reading costs far more than a blank one.
 */

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("MSEDCL HT industrial", () => {
  const parsed = parseBillFields(MSEDCL_HT_INDUSTRIAL.text);

  it("reads every field off the bill", () => {
    expect(parsed.discomCode).toBe("MSEDCL");
    expect(parsed.state).toBe("Maharashtra");
    expect(parsed.unitsConsumedKwh).toBe(1_250_000);
    expect(parsed.tariffCode).toBe("HT-I INDUSTRIAL");
    expect(parsed.tariffVoltage).toBe("HT");
    expect(parsed.tariffSegment).toBe("INDUSTRIAL");
    expect(parsed.sanctionedLoadValue).toBe(2500);
    expect(parsed.sanctionedLoadUnit).toBe("KVA");
    expect(iso(parsed.billingPeriodStart)).toBe("2026-06-01");
    expect(iso(parsed.billingPeriodEnd)).toBe("2026-06-30");
    expect(parsed.ratePerUnitInr).toBe(8.45);
  });

  it("prefers Sanctioned Load over the Contract Demand printed on the same line", () => {
    // 2400 KVA is the contract demand and sits on the same physical line. A
    // parser that took the last number on the line would report it as the
    // sanctioned load and be wrong by 100 KVA with full confidence.
    expect(parsed.sanctionedLoadValue).toBe(2500);
  });

  it("does not read 'Tariff Category' as a value for the shorter 'Tariff' label", () => {
    // Both labels start at the same position. Recording each as a separate
    // reading would make an unambiguous line look like a conflict.
    expect(parsed.fieldMeta.tariff.status).toBe("EXTRACTED");
  });

  it("rates a digitally-read, tier-1-labelled bill HIGH throughout", () => {
    for (const key of ["unitsConsumedKwh", "sanctionedLoad", "billingPeriod", "ratePerUnitInr"]) {
      const meta = parsed.fieldMeta[key];
      expect(meta.status, key).toBe("EXTRACTED");
      if (meta.status === "EXTRACTED") expect(meta.confidence, key).toBe("HIGH");
    }
  });
});

describe("format variation across discoms", () => {
  it("reads TANGEDCO's western digit grouping and DD-MM-YYYY dates", () => {
    const parsed = parseBillFields(TANGEDCO_HT.text);
    expect(parsed.discomCode).toBe("TANGEDCO");
    expect(parsed.state).toBe("Tamil Nadu");
    expect(parsed.unitsConsumedKwh).toBe(845_320);
    expect(iso(parsed.billingPeriodStart)).toBe("2026-07-01");
    expect(iso(parsed.billingPeriodEnd)).toBe("2026-07-31");
    expect(parsed.sanctionedLoadValue).toBe(1500);
    expect(parsed.ratePerUnitInr).toBe(7.9);
  });

  it("reads BESCOM's DD.MM.YYYY range and kW load", () => {
    const parsed = parseBillFields(BESCOM_LT_NO_UNIT_TOKEN.text);
    expect(parsed.discomCode).toBe("BESCOM");
    expect(parsed.state).toBe("Karnataka");
    expect(parsed.tariffVoltage).toBe("LT");
    expect(parsed.sanctionedLoadValue).toBe(85);
    expect(parsed.sanctionedLoadUnit).toBe("KW");
    expect(iso(parsed.billingPeriodStart)).toBe("2026-05-05");
    expect(iso(parsed.billingPeriodEnd)).toBe("2026-06-04");
  });

  it("caps a unit count printed with no unit symbol at MEDIUM and says why", () => {
    const parsed = parseBillFields(BESCOM_LT_NO_UNIT_TOKEN.text);
    expect(parsed.unitsConsumedKwh).toBe(42_500);
    const meta = parsed.fieldMeta.unitsConsumedKwh;
    expect(meta.status).toBe("EXTRACTED");
    if (meta.status === "EXTRACTED") {
      expect(meta.confidence).toBe("MEDIUM");
      expect(meta.reason).toMatch(/no unit symbol/i);
    }
  });

  it("converts MWh to kWh at the fixed factor and records the conversion", () => {
    const parsed = parseBillFields(PVVNL_BILLING_MONTH_ONLY.text);
    expect(parsed.discomCode).toBe("PVVNL");
    expect(parsed.unitsConsumedKwh).toBe(96_400);
    const meta = parsed.fieldMeta.unitsConsumedKwh;
    if (meta.status === "EXTRACTED") expect(meta.reason).toMatch(/1 MWh = 1,000 kWh/);
  });

  it("expands a billing month to that month's first and last day, at MEDIUM", () => {
    const parsed = parseBillFields(PVVNL_BILLING_MONTH_ONLY.text);
    expect(iso(parsed.billingPeriodStart)).toBe("2026-06-01");
    expect(iso(parsed.billingPeriodEnd)).toBe("2026-06-30");
    const meta = parsed.fieldMeta.billingPeriod;
    expect(meta.status).toBe("EXTRACTED");
    if (meta.status === "EXTRACTED") {
      expect(meta.confidence).toBe("MEDIUM");
      expect(meta.reason).toMatch(/billing month/i);
    }
  });

  it("still reads the numbers off a utility the registry has never seen", () => {
    const parsed = parseBillFields(UNKNOWN_DISCOM.text);
    expect(parsed.discomCode).toBeNull();
    expect(parsed.state).toBeNull();
    // The discom being unknown must not suppress the fields that were read.
    expect(parsed.unitsConsumedKwh).toBe(333_000);
    expect(parsed.sanctionedLoadValue).toBe(900);
  });
});

describe("refusing to guess", () => {
  it("will not convert kVAh to kWh, and explains what is missing", () => {
    const parsed = parseBillFields(TORRENT_KVAH_ONLY.text);
    expect(parsed.unitsConsumedKwh).toBeNull();
    const meta = parsed.fieldMeta.unitsConsumedKwh;
    expect(meta.status).toBe("NOT_EXTRACTED");
    if (meta.status === "NOT_EXTRACTED") {
      expect(meta.reason).toBe("UNIT_NOT_CONVERTIBLE");
      expect(meta.detail).toMatch(/power factor/i);
    }
    // The rest of the bill is unaffected — one unreadable field is not a
    // failed extraction.
    expect(parsed.sanctionedLoadValue).toBe(3000);
    expect(parsed.discomCode).toBe("TORRENT_POWER");
  });

  it("drops the field when two equally-strong readings disagree", () => {
    const parsed = parseBillFields(CONFLICTING_UNITS.text);
    expect(parsed.unitsConsumedKwh).toBeNull();
    const meta = parsed.fieldMeta.unitsConsumedKwh;
    expect(meta.status).toBe("NOT_EXTRACTED");
    if (meta.status === "NOT_EXTRACTED") {
      expect(meta.reason).toBe("AMBIGUOUS");
      expect(meta.detail).toMatch(/500000/);
      expect(meta.detail).toMatch(/620000/);
    }
  });

  it("flags a date range whose component order the text cannot confirm", () => {
    const parsed = parseBillFields(AMBIGUOUS_DATE_ORDER.text);
    // Day-first is still applied — it is the Indian convention and the only
    // defensible fixed rule — but the reading is demoted and labelled.
    expect(iso(parsed.billingPeriodStart)).toBe("2026-06-01");
    expect(iso(parsed.billingPeriodEnd)).toBe("2026-07-05");
    const meta = parsed.fieldMeta.billingPeriod;
    if (meta.status === "EXTRACTED") {
      expect(meta.confidence).toBe("MEDIUM");
      expect(meta.reason).toMatch(/cannot confirm the order/i);
    }
  });

  it("extracts nothing from a document that is not an electricity bill", () => {
    const parsed = parseBillFields(NOT_A_BILL.text);
    expect(parsed.unitsConsumedKwh).toBeNull();
    expect(parsed.sanctionedLoadValue).toBeNull();
    expect(parsed.discomCode).toBeNull();
    expect(parsed.billingPeriodStart).toBeNull();
    // "Total: Rs. 18,40,000" must not be read as a per-unit rate.
    expect(parsed.ratePerUnitInr).toBeNull();
  });

  it("rejects a rate outside any real retail tariff", () => {
    const parsed = parseBillFields("Tariff: HT-I\nRate Per Unit: 184000");
    expect(parsed.ratePerUnitInr).toBeNull();
  });

  it("rejects a consumption figure beyond any plausible bill", () => {
    const parsed = parseBillFields("Units Consumed: 99,000,000,000 kWh");
    expect(parsed.unitsConsumedKwh).toBeNull();
  });

  it("rejects a period that ends before it starts", () => {
    const parsed = parseBillFields("Billing Period: 30/06/2026 to 01/06/2026");
    expect(parsed.billingPeriodStart).toBeNull();
  });

  it("rejects an impossible date rather than rolling it over", () => {
    // JS Date would silently turn 31 February into 3 March.
    const parsed = parseBillFields("Billing Period: 31/02/2026 to 28/02/2026");
    expect(parsed.billingPeriodStart).toBeNull();
  });
});

describe("OCR confidence", () => {
  it("demotes every field one band when the page OCR'd below the bar", () => {
    const clean = parseBillFields(MSEDCL_HT_INDUSTRIAL.text);
    const noisy = parseBillFields(MSEDCL_HT_INDUSTRIAL.text, { ocrMeanConfidence: OCR_DEMOTION_THRESHOLD - 1 });

    const cleanMeta = clean.fieldMeta.unitsConsumedKwh;
    const noisyMeta = noisy.fieldMeta.unitsConsumedKwh;
    if (cleanMeta.status === "EXTRACTED") expect(cleanMeta.confidence).toBe("HIGH");
    if (noisyMeta.status === "EXTRACTED") {
      expect(noisyMeta.confidence).toBe("MEDIUM");
      expect(noisyMeta.reason).toMatch(/mean character confidence/);
    }
    // The values themselves are untouched — confidence describes the reading,
    // it does not alter it.
    expect(noisy.unitsConsumedKwh).toBe(clean.unitsConsumedKwh);
  });

  it("leaves confidence alone for a clean OCR page", () => {
    const parsed = parseBillFields(MSEDCL_HT_INDUSTRIAL.text, { ocrMeanConfidence: 95 });
    const meta = parsed.fieldMeta.unitsConsumedKwh;
    if (meta.status === "EXTRACTED") expect(meta.confidence).toBe("HIGH");
  });
});

describe("discom registry", () => {
  it("resolves the longest alias when several utilities share a state word", () => {
    expect(matchDiscom(normaliseText("MADHYA GUJARAT VIJ COMPANY LIMITED"))?.profile.code).toBe("MGVCL");
    expect(matchDiscom(normaliseText("PASCHIM GUJARAT VIJ COMPANY LIMITED"))?.profile.code).toBe("PGVCL");
  });

  it("requires utility context before accepting a short, everyday alias", () => {
    expect(matchDiscom(normaliseText("We offer the BEST prices in town"))).toBeNull();
    expect(matchDiscom(normaliseText("BRIHANMUMBAI ELECTRIC SUPPLY AND TRANSPORT"))?.profile.code).toBe("BEST");
  });

  it("does not match an alias embedded inside a longer word", () => {
    expect(matchDiscom(normaliseText("BESCOMPANY HOLDINGS"))).toBeNull();
  });

  it("returns nothing when two different utilities tie", () => {
    expect(matchDiscom(normaliseText("BESCOM MESCOM"))).toBeNull();
  });
});

describe("every fixture", () => {
  it("parses without throwing and records a reason for each field", () => {
    for (const fixture of ALL_FIXTURES) {
      const parsed = parseBillFields(fixture.text);
      for (const key of ["unitsConsumedKwh", "ratePerUnitInr", "sanctionedLoad", "tariff", "billingPeriod", "discom", "state"]) {
        expect(parsed.fieldMeta[key], `${fixture.name} / ${key}`).toBeDefined();
      }
    }
  });
});
