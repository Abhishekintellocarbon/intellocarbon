/**
 * Sector benchmarking.
 *
 * ===========================================================================
 * THE RULE: NO NUMBER APPEARS HERE THAT DOES NOT COME FROM A REAL, CITED,
 * PUBLIC SOURCE. Where one does not exist, this returns "not available for
 * this sector" and the UI says exactly that.
 *
 * A fabricated benchmark is worse than no benchmark. A customer who sees
 * "sector average: 1.8 tCO2e/t" next to their own 2.1 will act on it — raise
 * it with their board, put it in a tender response, use it to argue their
 * position is normal. A plausible-looking number is indistinguishable from a
 * real one on screen, which is exactly why inventing one is not a shortcut but
 * a defect.
 *
 * TWO SOURCES WERE CONSIDERED AND ONE WAS REJECTED.
 *
 * Used: BEE-notified CCTS intensity targets, from CctsObligatedEntity. These
 * come from gazette notifications, each row carries its notification reference
 * and a last-verified date, and a Super Admin maintains them. That is a real
 * public benchmark for GHG intensity in a notified sector.
 *
 * NOT used: the EU default SEE values in data/cbamReferenceData.ts. They look
 * like an ideal benchmark and they are not one — their own source string reads
 * "Illustrative default — confirm against Commission Implementing Regulation
 * (EU) 2025/2621 ... before relying on this for a regulatory submission."
 * They are placeholders standing in for the real CN-code-specific values.
 * Surfacing them as sector benchmarks would put invented numbers in front of
 * customers with a regulation cited beside them, which is the precise failure
 * this module exists to avoid. If the real published defaults are loaded into
 * that file later, they become a legitimate second source and can be added
 * here — deliberately, by someone who checked.
 * ===========================================================================
 */

export type BenchmarkStatus =
  | "AVAILABLE"
  | "NO_SECTOR_DATA"
  | "SAMPLE_TOO_SMALL"
  | "NO_COMPANY_VALUE";

export interface SectorBenchmark {
  metricKey: string;
  label: string;
  unit: string;
  status: BenchmarkStatus;
  /** Always populated when status is not AVAILABLE. Shown verbatim. */
  unavailableReason: string | null;
  companyValue: number | null;
  benchmarkValue: number | null;
  /** How many notified entities the benchmark was computed from. */
  sampleSize: number;
  /** Citation. Null whenever benchmarkValue is null — the two travel together. */
  source: string | null;
  comparison: "BETTER" | "WORSE" | "SIMILAR" | null;
  differencePct: number | null;
}

/**
 * Below this, a "sector average" is one or two identifiable companies rather
 * than a benchmark — misleading as a comparator, and a disclosure of those
 * entities' positions to a competitor. Three is the smallest number for which
 * a median means anything at all.
 */
export const MIN_BENCHMARK_SAMPLE = 3;

/** Within this band of the benchmark, "better" and "worse" overstate the difference. */
const SIMILAR_BAND_PCT = 5;

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export interface NotifiedEntity {
  sector: string;
  baselineIntensity: number | null;
  status: string;
}

const NOT_AVAILABLE_COPY = "Benchmark not available for this sector";

/**
 * GHG intensity against BEE-notified CCTS baselines for the same sector.
 *
 * Median rather than mean: notified baselines within a sector span very
 * different plant vintages and routes, and a single integrated mill would drag
 * a mean well away from what a typical entity looks like.
 */
export const buildIntensityBenchmark = (
  companySector: string,
  companyIntensity: number | null,
  entities: NotifiedEntity[],
): SectorBenchmark => {
  const base = {
    metricKey: "ghgIntensity",
    label: "GHG intensity",
    unit: "tCO2e per tonne of product",
    companyValue: companyIntensity,
    benchmarkValue: null,
    sampleSize: 0,
    source: null,
    comparison: null,
    differencePct: null,
  } satisfies Omit<SectorBenchmark, "status" | "unavailableReason">;

  // Gazetted entries only. A DRAFT notification is still open for comment and
  // its numbers may move, so benchmarking against one would compare a real
  // position to a provisional figure.
  const matching = entities.filter(
    (e) => e.status === "FINAL" && e.sector.toLowerCase() === companySector.toLowerCase() && e.baselineIntensity != null,
  );
  const values = matching.map((e) => e.baselineIntensity!).filter((v) => v > 0);

  if (values.length === 0) {
    return {
      ...base,
      status: "NO_SECTOR_DATA",
      unavailableReason: `${NOT_AVAILABLE_COPY}. No gazetted CCTS entity in ${companySector} has a notified intensity on file, so there is no public figure to compare against.`,
    };
  }

  if (values.length < MIN_BENCHMARK_SAMPLE) {
    return {
      ...base,
      status: "SAMPLE_TOO_SMALL",
      sampleSize: values.length,
      unavailableReason: `${NOT_AVAILABLE_COPY}. Only ${values.length} gazetted ${companySector} ${values.length === 1 ? "entity has" : "entities have"} a notified intensity, which is too few to form a benchmark — it would describe those specific companies rather than the sector.`,
    };
  }

  const benchmarkValue = round(median(values));
  const source = `Median of ${values.length} BEE-notified CCTS baseline intensities for ${companySector}, from gazetted obligated-entity notifications.`;

  if (companyIntensity == null || companyIntensity <= 0) {
    return {
      ...base,
      status: "NO_COMPANY_VALUE",
      benchmarkValue,
      sampleSize: values.length,
      source,
      unavailableReason:
        "Submit activity data with production quantities so your own GHG intensity can be calculated and compared.",
    };
  }

  const differencePct = round(((companyIntensity - benchmarkValue) / benchmarkValue) * 100, 1);
  const comparison =
    Math.abs(differencePct) <= SIMILAR_BAND_PCT ? "SIMILAR" : differencePct < 0 ? "BETTER" : "WORSE";

  return {
    metricKey: "ghgIntensity",
    label: "GHG intensity",
    unit: "tCO2e per tonne of product",
    status: "AVAILABLE",
    unavailableReason: null,
    companyValue: round(companyIntensity),
    benchmarkValue,
    sampleSize: values.length,
    source,
    comparison,
    differencePct,
  };
};

/**
 * Metrics a benchmark was wanted for but no public source exists to support.
 *
 * These are returned explicitly rather than omitted. A missing card reads as
 * "not built yet"; a card saying no public benchmark exists tells the user
 * something true about the state of the data, and stops the question being
 * asked again.
 */
export const UNSOURCED_METRICS: { metricKey: string; label: string; unit: string; why: string }[] = [
  {
    metricKey: "waterIntensity",
    label: "Water intensity",
    unit: "m³ per tonne of product",
    why: "No public sector-average water intensity is published for Indian industry at a granularity this platform can cite. CCTS notifications cover GHG intensity only.",
  },
  {
    metricKey: "wasteIntensity",
    label: "Waste intensity",
    unit: "tonnes per tonne of product",
    why: "No public sector-average waste intensity exists that is comparable across the routes and product mixes in these sectors.",
  },
];

export interface BenchmarkSet {
  sector: string;
  benchmarks: SectorBenchmark[];
  unsourced: typeof UNSOURCED_METRICS;
  notice: string;
}

export const BENCHMARK_NOTICE =
  "Benchmarks are shown only where a real public figure exists to cite. Where none does, this says so rather than " +
  "showing an estimate — a plausible-looking number you cannot trace is worse than no number, because it looks the " +
  "same as one you can.";

export const buildBenchmarkSet = (
  companySector: string,
  companyIntensity: number | null,
  entities: NotifiedEntity[],
): BenchmarkSet => ({
  sector: companySector,
  benchmarks: [buildIntensityBenchmark(companySector, companyIntensity, entities)],
  unsourced: UNSOURCED_METRICS,
  notice: BENCHMARK_NOTICE,
});
