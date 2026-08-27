/**
 * Deterministic field extraction from electricity bill text.
 *
 * Every value this produces is a substring of the bill, or an arithmetic
 * conversion of one by a fixed factor (kWh <- MWh, month -> first/last day).
 * There is no model, no scoring against a corpus, no nearest-match, and no
 * inference from one field to another: a bill that prints units but not a
 * tariff yields units and a null tariff. Where the text supports two different
 * readings, the field is dropped and marked AMBIGUOUS for manual entry rather
 * than resolved by preference — that is the platform's no-invented-values rule
 * applied to reading rather than to calculation.
 *
 * Confidence is a band, not a score. Bands are assigned by fixed rules stated
 * at each field, so "MEDIUM" always means the same thing and a verifier can be
 * told exactly what it means, rather than a percentage nobody can account for.
 */
import { matchDiscom } from "./discomProfiles";

export type FieldConfidence = "HIGH" | "MEDIUM" | "LOW";

export type FieldProvenance =
  | { status: "EXTRACTED"; confidence: FieldConfidence; reason: string; rawText: string }
  | { status: "NOT_EXTRACTED"; reason: NotExtractedReason; detail?: string };

export type NotExtractedReason =
  /** No label for this field appears anywhere in the text. */
  | "NOT_FOUND"
  /** Two or more equally-strong readings disagree — deliberately not resolved. */
  | "AMBIGUOUS"
  /** Found, but in a unit that cannot be converted without a value the bill doesn't print. */
  | "UNIT_NOT_CONVERTIBLE"
  /** Found and parsed, but outside any physically plausible range for the field. */
  | "OUT_OF_RANGE"
  /** A label was found but the text after it did not parse as the expected type. */
  | "UNPARSEABLE";

export type ParsedBillFields = {
  state: string | null;
  discomName: string | null;
  discomCode: string | null;
  unitsConsumedKwh: number | null;
  tariffCode: string | null;
  tariffVoltage: string | null;
  tariffSegment: string | null;
  sanctionedLoadValue: number | null;
  sanctionedLoadUnit: string | null;
  billingPeriodStart: Date | null;
  billingPeriodEnd: Date | null;
  ratePerUnitInr: number | null;
  fieldMeta: Record<string, FieldProvenance>;
};

// --- Normalisation ---------------------------------------------------------

/**
 * Uppercases and collapses runs of spaces, but preserves line breaks.
 *
 * Line structure is load-bearing: every label below only accepts a value found
 * on the same line as its label. Flattening the document to one string would
 * let "Sanctioned Load" on one line capture the number from an unrelated line
 * underneath it, which is exactly the class of silent wrong answer this parser
 * exists to avoid.
 */
export const normaliseText = (raw: string): string =>
  raw
    .replace(/\u00a0/g, " ")
    .replace(/[‐-―]/g, "-")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .toUpperCase();

/**
 * Indian bills group digits either western (1,250,000) or in lakhs
 * (12,50,000). Both mean the same number once separators are removed, so
 * commas are stripped rather than interpreted — no grouping convention is
 * assumed, and none needs to be.
 */
const parseNumber = (token: string): number | null => {
  const cleaned = token.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

type LabelHit = { label: string; tier: 1 | 2; line: string; after: string };

const isWordChar = (c: string | undefined) => c !== undefined && /[A-Z0-9]/.test(c);

/**
 * Finds every line carrying one of `labels`, returning the remainder of that
 * line after the label. Tier 1 labels name the field unambiguously; tier 2
 * labels are looser wordings that also appear on bills but could plausibly
 * head a different number, and can therefore never yield HIGH confidence.
 *
 * Where two labels start at the same position the longer one wins, and the
 * shorter is discarded rather than recorded as a second reading. Without that,
 * "Tariff Category: HT-I" is found both by "TARIFF CATEGORY" (value "HT-I")
 * and by "TARIFF" (value "CATEGORY"), and the field is thrown away as
 * ambiguous when the line is in fact perfectly clear. Two labels at *different*
 * positions are kept — "Sanctioned Load: 2500 KVA  Contract Demand: 2400 KVA"
 * really is two readings on one line, and the tier rule decides between them.
 */
const findLabelHits = (text: string, tier1: string[], tier2: string[]): LabelHit[] => {
  const hits: LabelHit[] = [];
  for (const line of text.split("\n")) {
    // index -> the longest label found starting there
    const byIndex = new Map<number, { label: string; tier: 1 | 2 }>();

    for (const [labels, tier] of [
      [tier1, 1],
      [tier2, 2],
    ] as const) {
      for (const label of labels) {
        let from = 0;
        for (;;) {
          const at = line.indexOf(label, from);
          if (at === -1) break;
          from = at + 1;
          // Must be a whole word on both sides, so "UNITS" doesn't match
          // inside "SUBUNITS" and "RATE" doesn't match inside "RATEABLE".
          if (isWordChar(line[at - 1])) continue;
          const after = line.slice(at + label.length);
          if (isWordChar(after[0])) continue;
          const existing = byIndex.get(at);
          if (!existing || label.length > existing.label.length) byIndex.set(at, { label, tier });
        }
      }
    }

    for (const [at, { label, tier }] of byIndex) {
      // The separator between label and value is optional punctuation, so both
      // "Units Consumed: 1250" and column-aligned "Units Consumed   1250" work.
      const after = line.slice(at + label.length).replace(/^\s*[:-]?\s*/, "");
      hits.push({ label, tier, line, after });
    }
  }
  return hits;
};

/** Collapses candidate readings to one value, or reports why it can't. */
const resolveCandidates = <T,>(
  candidates: Array<{ value: T; tier: 1 | 2; confidence: FieldConfidence; reason: string; rawText: string }>,
  same: (a: T, b: T) => boolean,
):
  | { ok: true; value: T; confidence: FieldConfidence; reason: string; rawText: string }
  | { ok: false; reason: NotExtractedReason; detail?: string } => {
  if (candidates.length === 0) return { ok: false, reason: "NOT_FOUND" };

  // A single tier-1 reading beats any number of tier-2 readings: a bill that
  // prints "Units Consumed 1250" and also "Consumption 1250 (last year)" is
  // not ambiguous, it just has one authoritative label and one loose one.
  const tier1 = candidates.filter((c) => c.tier === 1);
  const pool = tier1.length > 0 ? tier1 : candidates;

  const distinct: typeof pool = [];
  for (const c of pool) if (!distinct.some((d) => same(d.value, c.value))) distinct.push(c);

  if (distinct.length > 1) {
    return {
      ok: false,
      reason: "AMBIGUOUS",
      detail: `${distinct.length} conflicting readings: ${distinct.map((d) => d.rawText).join(" | ")}`,
    };
  }
  const [only] = distinct;
  return { ok: true, value: only.value, confidence: only.confidence, reason: only.reason, rawText: only.rawText };
};

// --- Units consumed --------------------------------------------------------

const UNITS_TIER1 = [
  "TOTAL UNITS CONSUMED",
  "NET UNITS CONSUMED",
  "TOTAL ENERGY CONSUMED",
  "UNITS CONSUMED",
  "ENERGY CONSUMED",
  "UNITS BILLED",
  "BILLED UNITS",
  "KWH CONSUMED",
];
const UNITS_TIER2 = ["TOTAL CONSUMPTION", "TOTAL UNITS", "NET UNITS", "CONSUMPTION", "UNITS"];

/** Upper bound is a sanity rail, not a business rule: 5 TWh in one bill is not a real reading. */
const MAX_PLAUSIBLE_KWH = 5_000_000_000;

const parseUnitsConsumed = (text: string): { value: number | null; meta: FieldProvenance } => {
  const hits = findLabelHits(text, UNITS_TIER1, UNITS_TIER2);
  const candidates: Array<{ value: number; tier: 1 | 2; confidence: FieldConfidence; reason: string; rawText: string }> = [];
  let sawKvahOnly = false;

  for (const hit of hits) {
    const m = /^\(?\s*(?:KWH|KVAH|MWH|MU|UNITS?)?\s*\)?\s*[:-]?\s*([\d][\d,]*(?:\.\d+)?)\s*(KWH|KVAH|MWH|MU|UNITS?)?/.exec(hit.after);
    if (!m) continue;
    const value = parseNumber(m[1]);
    if (value === null) continue;

    // Unit may sit before the number ("kWh Consumed: 1250") or after it
    // ("1250 kWh"); a unit in the label itself counts too.
    const unitBefore = /^\(?\s*(KWH|KVAH|MWH|MU|UNITS?)/.exec(hit.after)?.[1];
    const unit = m[2] ?? unitBefore ?? (hit.label.includes("KWH") ? "KWH" : undefined);

    if (unit === "KVAH") {
      // Apparent energy. Converting to active energy needs the power factor,
      // which many bills do not print — and assuming one would silently change
      // a Scope 2 number. Recorded, never converted.
      sawKvahOnly = true;
      continue;
    }

    let kwh = value;
    let confidence: FieldConfidence = hit.tier === 1 ? "HIGH" : "MEDIUM";
    let reason: string;
    if (unit === "MWH") {
      kwh = value * 1_000;
      reason = `Read "${m[1]} MWh" and converted to kWh at the fixed factor 1 MWh = 1,000 kWh.`;
    } else if (unit === "MU") {
      kwh = value * 1_000_000;
      confidence = "MEDIUM";
      reason = `Read "${m[1]} MU" (million units) and converted at 1 MU = 1,000,000 kWh.`;
    } else if (unit === "KWH") {
      reason = `Read directly from "${hit.line.trim()}".`;
    } else {
      // "Units" with no unit token. On an Indian electricity bill this is
      // always active energy in kWh, but because the bill does not say so in
      // words, it is capped at MEDIUM and the assumption is stated on screen
      // rather than hidden in the number.
      confidence = "MEDIUM";
      reason = `Bill prints a unit count with no unit symbol; read as kWh, which is what "units" denotes on an Indian electricity bill. Confirm against the bill.`;
    }

    if (kwh <= 0 || kwh > MAX_PLAUSIBLE_KWH) continue;
    candidates.push({ value: kwh, tier: hit.tier, confidence, reason, rawText: hit.line.trim() });
  }

  const resolved = resolveCandidates(candidates, (a, b) => a === b);
  if (!resolved.ok) {
    if (resolved.reason === "NOT_FOUND" && sawKvahOnly) {
      return {
        value: null,
        meta: {
          status: "NOT_EXTRACTED",
          reason: "UNIT_NOT_CONVERTIBLE",
          detail:
            "The bill states consumption in kVAh (apparent energy) only. Converting kVAh to kWh requires the power factor, which this bill does not print — enter the kWh figure manually.",
        },
      };
    }
    return { value: null, meta: { status: "NOT_EXTRACTED", reason: resolved.reason, detail: resolved.detail } };
  }
  return {
    value: resolved.value,
    meta: { status: "EXTRACTED", confidence: resolved.confidence, reason: resolved.reason, rawText: resolved.rawText },
  };
};

// --- Rate per unit ---------------------------------------------------------

const RATE_TIER1 = ["RATE PER UNIT", "PER UNIT RATE", "RATE/UNIT", "AVERAGE RATE PER UNIT", "AVG RATE PER UNIT"];
const RATE_TIER2 = ["AVERAGE RATE", "AVG RATE", "TARIFF RATE", "UNIT RATE", "RATE"];

// Retail electricity in India has never been below ~Rs 1/kWh or above ~Rs 50/kWh.
// A "rate" outside that is some other number that happened to sit after the word.
const MIN_PLAUSIBLE_RATE = 0.5;
const MAX_PLAUSIBLE_RATE = 50;

const parseRatePerUnit = (text: string): { value: number | null; meta: FieldProvenance } => {
  const hits = findLabelHits(text, RATE_TIER1, RATE_TIER2);
  const candidates: Array<{ value: number; tier: 1 | 2; confidence: FieldConfidence; reason: string; rawText: string }> = [];

  for (const hit of hits) {
    const m = /^(?:RS\.?|INR|₹)?\s*[:-]?\s*([\d][\d,]*(?:\.\d+)?)/.exec(hit.after);
    if (!m) continue;
    const value = parseNumber(m[1]);
    if (value === null || value < MIN_PLAUSIBLE_RATE || value > MAX_PLAUSIBLE_RATE) continue;
    candidates.push({
      value,
      tier: hit.tier,
      confidence: hit.tier === 1 ? "HIGH" : "MEDIUM",
      reason: `Read from "${hit.line.trim()}".`,
      rawText: hit.line.trim(),
    });
  }

  const resolved = resolveCandidates(candidates, (a, b) => Math.abs(a - b) < 0.0001);
  if (!resolved.ok) return { value: null, meta: { status: "NOT_EXTRACTED", reason: resolved.reason, detail: resolved.detail } };
  return {
    value: resolved.value,
    meta: { status: "EXTRACTED", confidence: resolved.confidence, reason: resolved.reason, rawText: resolved.rawText },
  };
};

// --- Sanctioned load -------------------------------------------------------

// "Connected load" is deliberately absent: it is a different quantity from
// sanctioned load (the sum of equipment ratings vs the contracted ceiling) and
// treating them as interchangeable would put a wrong number on screen under
// the right label.
const LOAD_TIER1 = ["SANCTIONED LOAD", "SANCTIONED DEMAND", "SANCTION LOAD"];
const LOAD_TIER2 = ["CONTRACT DEMAND", "CONTRACTED DEMAND", "CONTRACTED LOAD", "BILLING DEMAND"];

const parseSanctionedLoad = (
  text: string,
): { value: number | null; unit: string | null; meta: FieldProvenance } => {
  const hits = findLabelHits(text, LOAD_TIER1, LOAD_TIER2);
  const candidates: Array<{
    value: { value: number; unit: string };
    tier: 1 | 2;
    confidence: FieldConfidence;
    reason: string;
    rawText: string;
  }> = [];

  for (const hit of hits) {
    const m = /^([\d][\d,]*(?:\.\d+)?)\s*(KVA|MVA|KW|MW|HP)\b/.exec(hit.after);
    if (!m) continue;
    const value = parseNumber(m[1]);
    if (value === null || value <= 0) continue;
    // Unit is stored as printed. KVA, KW and HP are not interconvertible
    // without a power factor or a motor-efficiency figure, neither of which
    // appears on a bill, so no normalisation is attempted.
    candidates.push({
      value: { value, unit: m[2] },
      tier: hit.tier,
      confidence: hit.tier === 1 ? "HIGH" : "MEDIUM",
      reason:
        hit.tier === 1
          ? `Read from "${hit.line.trim()}".`
          : `Read from "${hit.line.trim()}" — this bill labels it "${hit.label}" rather than "Sanctioned Load"; confirm the two mean the same thing here.`,
      rawText: hit.line.trim(),
    });
  }

  const resolved = resolveCandidates(candidates, (a, b) => a.value === b.value && a.unit === b.unit);
  if (!resolved.ok) {
    return { value: null, unit: null, meta: { status: "NOT_EXTRACTED", reason: resolved.reason, detail: resolved.detail } };
  }
  return {
    value: resolved.value.value,
    unit: resolved.value.unit,
    meta: { status: "EXTRACTED", confidence: resolved.confidence, reason: resolved.reason, rawText: resolved.rawText },
  };
};

// --- Tariff ----------------------------------------------------------------

const TARIFF_TIER1 = ["TARIFF CATEGORY", "TARIFF CODE", "TARIFF"];
const TARIFF_TIER2 = ["CONSUMER CATEGORY", "RATE CATEGORY", "CATEGORY", "SUPPLY TYPE"];

const parseTariff = (
  text: string,
): { code: string | null; voltage: string | null; segment: string | null; meta: FieldProvenance } => {
  const hits = findLabelHits(text, TARIFF_TIER1, TARIFF_TIER2);
  const candidates: Array<{ value: string; tier: 1 | 2; confidence: FieldConfidence; reason: string; rawText: string }> = [];

  for (const hit of hits) {
    // A tariff code is a short alphanumeric token, optionally bracketed:
    // "HT-I", "LT-V(B)", "HTP-I", "LT5". Capped at 24 characters so a label
    // followed by a whole sentence doesn't get stored as a "code".
    const m = /^([A-Z]{1,4}[-A-Z0-9()/. ]{0,20})/.exec(hit.after.trim());
    const code = m?.[1]?.trim().replace(/[.,;]+$/, "");
    if (!code || code.length < 2) continue;
    candidates.push({
      value: code,
      tier: hit.tier,
      confidence: hit.tier === 1 ? "HIGH" : "MEDIUM",
      reason: `Read from "${hit.line.trim()}".`,
      rawText: hit.line.trim(),
    });
  }

  const resolved = resolveCandidates(candidates, (a, b) => a === b);
  if (!resolved.ok) {
    return { code: null, voltage: null, segment: null, meta: { status: "NOT_EXTRACTED", reason: resolved.reason, detail: resolved.detail } };
  }

  // Voltage and segment are read out of the matched line, never inferred from
  // each other — an "HT" code does not imply industrial, and "Industrial" does
  // not imply HT. Either can be null while the other is set.
  const line = resolved.rawText;
  const voltage = /\bEHT\b|\bEHV\b/.test(line) ? "EHT" : /\bHT\b|\bHTP\b|\bHV\b/.test(line) ? "HT" : /\bLT\b|\bLV\b/.test(line) ? "LT" : null;
  const segment = /\bINDUSTR/.test(line)
    ? "INDUSTRIAL"
    : /\bCOMMERCIAL\b|\bNON[- ]?DOMESTIC\b/.test(line)
      ? "COMMERCIAL"
      : /\bDOMESTIC\b|\bRESIDENTIAL\b/.test(line)
        ? "RESIDENTIAL"
        : /\bAGRICULTUR/.test(line)
          ? "AGRICULTURAL"
          : null;

  return {
    code: resolved.value,
    voltage,
    segment,
    meta: { status: "EXTRACTED", confidence: resolved.confidence, reason: resolved.reason, rawText: resolved.rawText },
  };
};

// --- Billing period --------------------------------------------------------

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const PERIOD_TIER1 = ["BILLING PERIOD", "BILL PERIOD", "CONSUMPTION PERIOD", "PERIOD OF SUPPLY", "BILLING CYCLE"];
const PERIOD_TIER2 = ["PERIOD", "FROM"];
const MONTH_TIER1 = ["BILLING MONTH", "BILL MONTH", "MONTH OF BILL"];

/** UTC so a stored bill period never shifts a day when read back in another timezone. */
const utcDate = (y: number, m: number, d: number): Date | null => {
  const date = new Date(Date.UTC(y, m, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m || date.getUTCDate() !== d) return null;
  return date;
};

type DateReading = {
  date: Date;
  /** True when this token alone could also be read month-first. */
  ambiguous: boolean;
  /**
   * True when this token settles the format for the whole range — a first
   * component above 12 can only be a day, and a spelled-out month can only be
   * a month.
   */
  provesDayFirst: boolean;
};

/**
 * Parses one date, day-first.
 *
 * Indian bills are day-first without exception, so that is the rule applied —
 * but when both components are 12 or under the text alone cannot confirm it,
 * and the reading is marked ambiguous so the field lands at MEDIUM and the
 * caller can say so on screen. It is never silently re-read as month-first.
 */
const parseOneDate = (token: string): DateReading | null => {
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(token);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const yearRaw = Number(m[3]);
    const year = m[3].length === 2 ? 2000 + yearRaw : yearRaw;
    const date = utcDate(year, month - 1, day);
    if (!date) return null;
    return {
      date,
      ambiguous: day <= 12 && month <= 12 && day !== month,
      provesDayFirst: day > 12,
    };
  }
  m = /^(\d{1,2})[-. ]?([A-Z]{3})[A-Z]*[-. ]?(\d{2,4})$/.exec(token);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2]];
    if (month === undefined) return null;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const date = utcDate(year, month, day);
    if (!date) return null;
    // A named month cannot be confused with a day.
    return { date, ambiguous: false, provesDayFirst: true };
  }
  return null;
};

const DATE_TOKEN = String.raw`\d{1,2}[\/\-. ]?(?:\d{1,2}|[A-Z]{3,9})[\/\-. ]?\d{2,4}`;

const parseBillingPeriod = (
  text: string,
): { start: Date | null; end: Date | null; meta: FieldProvenance } => {
  const hits = findLabelHits(text, PERIOD_TIER1, PERIOD_TIER2);
  const candidates: Array<{
    value: { start: Date; end: Date };
    tier: 1 | 2;
    confidence: FieldConfidence;
    reason: string;
    rawText: string;
  }> = [];

  for (const hit of hits) {
    const re = new RegExp(`(${DATE_TOKEN})\\s*(?:TO|TILL|UPTO|-|–|—)\\s*(${DATE_TOKEN})`);
    const m = re.exec(hit.after);
    if (!m) continue;
    const from = parseOneDate(m[1].trim().replace(/ /g, "-"));
    const to = parseOneDate(m[2].trim().replace(/ /g, "-"));
    if (!from || !to) continue;
    // A period that ends before it starts is a misread, not a period.
    if (to.date.getTime() < from.date.getTime()) continue;

    // One bill prints both ends of a range in one format, so an endpoint that
    // settles the format settles it for the pair. "01/06/2026 to 30/06/2026"
    // is not ambiguous: 30 can only be a day, which makes the first token
    // day-first too. Without this the most common range on any Indian bill
    // would be permanently demoted to MEDIUM and flagged for a check that has
    // already been answered by the text.
    const formatSettled = from.provesDayFirst || to.provesDayFirst;
    const ambiguous = !formatSettled && (from.ambiguous || to.ambiguous);
    candidates.push({
      value: { start: from.date, end: to.date },
      tier: hit.tier,
      confidence: ambiguous ? "MEDIUM" : hit.tier === 1 ? "HIGH" : "MEDIUM",
      reason: ambiguous
        ? `Read from "${hit.line.trim()}" as day-first (DD/MM), the Indian bill convention. Both components are 12 or under, so the text alone cannot confirm the order — check the dates against the bill.`
        : `Read from "${hit.line.trim()}".`,
      rawText: hit.line.trim(),
    });
  }

  const explicit = resolveCandidates(
    candidates,
    (a, b) => a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime(),
  );
  if (explicit.ok) {
    return {
      start: explicit.value.start,
      end: explicit.value.end,
      meta: { status: "EXTRACTED", confidence: explicit.confidence, reason: explicit.reason, rawText: explicit.rawText },
    };
  }
  if (explicit.reason === "AMBIGUOUS") {
    return { start: null, end: null, meta: { status: "NOT_EXTRACTED", reason: "AMBIGUOUS", detail: explicit.detail } };
  }

  // Fallback: many bills print only a billing month. First-to-last day of that
  // month is arithmetic on a printed value, not an estimate — but it is a
  // whole-month assumption about a cycle that may not run month-aligned, so it
  // is capped at MEDIUM and says so.
  for (const hit of findLabelHits(text, MONTH_TIER1, [])) {
    const m = /^([A-Z]{3,9})[-./ ]+(\d{4}|\d{2})\b/.exec(hit.after.trim());
    if (!m) continue;
    const month = MONTHS[m[1].slice(0, 3)];
    if (month === undefined) continue;
    const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
    const start = utcDate(year, month, 1);
    const end = start ? new Date(Date.UTC(year, month + 1, 0)) : null;
    if (!start || !end) continue;
    return {
      start,
      end,
      meta: {
        status: "EXTRACTED",
        confidence: "MEDIUM",
        reason: `The bill prints a billing month ("${hit.line.trim()}") rather than a date range. Shown as the first and last day of that month — confirm the actual meter reading dates on the bill.`,
        rawText: hit.line.trim(),
      },
    };
  }

  return { start: null, end: null, meta: { status: "NOT_EXTRACTED", reason: "NOT_FOUND" } };
};

// --- Orchestration ---------------------------------------------------------

/** Below this Tesseract page confidence, every field is demoted one band. */
export const OCR_DEMOTION_THRESHOLD = 70;

const demote = (c: FieldConfidence): FieldConfidence => (c === "HIGH" ? "MEDIUM" : c === "MEDIUM" ? "LOW" : "LOW");

export const parseBillFields = (
  rawText: string,
  options: { ocrMeanConfidence?: number | null } = {},
): ParsedBillFields => {
  const text = normaliseText(rawText);

  const discom = matchDiscom(text);
  const units = parseUnitsConsumed(text);
  const rate = parseRatePerUnit(text);
  const load = parseSanctionedLoad(text);
  const tariff = parseTariff(text);
  const period = parseBillingPeriod(text);

  const fieldMeta: Record<string, FieldProvenance> = {
    discom: discom
      ? {
          status: "EXTRACTED",
          confidence: discom.confidence,
          reason: `Matched the registered distribution utility "${discom.matchedAlias}" in the bill text.`,
          rawText: discom.matchedAlias,
        }
      : { status: "NOT_EXTRACTED", reason: "NOT_FOUND", detail: "No known Indian distribution utility name appears in this document." },
    state: discom
      ? {
          status: "EXTRACTED",
          confidence: discom.confidence,
          reason: `${discom.profile.name} distributes in ${discom.profile.state}. Read from the utility, not from the bill's address block.`,
          rawText: discom.matchedAlias,
        }
      : { status: "NOT_EXTRACTED", reason: "NOT_FOUND", detail: "State follows from the distribution utility, which was not identified." },
    unitsConsumedKwh: units.meta,
    ratePerUnitInr: rate.meta,
    sanctionedLoad: load.meta,
    tariff: tariff.meta,
    billingPeriod: period.meta,
  };

  // A low-confidence OCR page makes every character on it less trustworthy,
  // including the ones inside a value that parsed cleanly. Demotion is applied
  // uniformly rather than per-field because the page confidence is a page
  // property — pretending it localises to a field would be a finer claim than
  // the evidence supports.
  const meanOcr = options.ocrMeanConfidence;
  if (typeof meanOcr === "number" && meanOcr < OCR_DEMOTION_THRESHOLD) {
    for (const [key, meta] of Object.entries(fieldMeta)) {
      if (meta.status !== "EXTRACTED") continue;
      fieldMeta[key] = {
        ...meta,
        confidence: demote(meta.confidence),
        reason: `${meta.reason} Confidence lowered one band: this page OCR'd at ${Math.round(meanOcr)}% mean character confidence, below the ${OCR_DEMOTION_THRESHOLD}% bar.`,
      };
    }
  }

  return {
    state: discom?.profile.state ?? null,
    discomName: discom?.profile.name ?? null,
    discomCode: discom?.profile.code ?? null,
    unitsConsumedKwh: units.value,
    tariffCode: tariff.code,
    tariffVoltage: tariff.voltage,
    tariffSegment: tariff.segment,
    sanctionedLoadValue: load.value,
    sanctionedLoadUnit: load.unit,
    billingPeriodStart: period.start,
    billingPeriodEnd: period.end,
    ratePerUnitInr: rate.value,
    fieldMeta,
  };
};
