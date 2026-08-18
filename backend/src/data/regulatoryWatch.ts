/**
 * Seed entries for the Super Admin regulatory watch.
 *
 * These are STARTING POINTS, not verified positions. Each summary describes
 * what the regime is — the stable part — and deliberately avoids stating
 * deadlines, applicability thresholds or approval counts, which move and which
 * nobody here has checked against the source today.
 *
 * The same discipline as the ESRS and CDP registries: an entry seeded from
 * general knowledge is marked as such, and `lastVerifiedAt` only means
 * something once a Super Admin has opened the source and updated it. The admin
 * list sorts on that field so stale entries surface rather than sitting there
 * looking current.
 *
 * Seeding is idempotent on `title` and never overwrites an entry a Super Admin
 * has edited — see seedRegulatoryWatch.
 */

export interface RegulatoryWatchSeed {
  regime: "ICVCM" | "ARTICLE_6_PACM" | "DIGITAL_PRODUCT_PASSPORT" | "TNFD" | "OTHER";
  title: string;
  summary: string;
  sourceUrl: string;
  nextMilestone: string | null;
}

const SEED_CAVEAT = "Seeded entry — confirm the current position against the source before relying on it.";

export const REGULATORY_WATCH_SEEDS: RegulatoryWatchSeed[] = [
  {
    regime: "ICVCM",
    title: "ICVCM Core Carbon Principles — programme and methodology approvals",
    summary:
      "The Integrity Council for the Voluntary Carbon Market assesses carbon-crediting programmes and their " +
      "methodologies against its Core Carbon Principles, labelling those that pass as CCP-approved. Relevant here " +
      "because the voluntary offsets ledger records a registry per purchase, and CCP approval status is the " +
      `emerging quality signal buyers ask about for those credits. ${SEED_CAVEAT}`,
    sourceUrl: "https://icvcm.org/",
    nextMilestone: null,
  },
  {
    regime: "ARTICLE_6_PACM",
    title: "Paris Agreement Crediting Mechanism (Article 6.4) — methodology approvals",
    summary:
      "The crediting mechanism established under Article 6.4 of the Paris Agreement, supervised by its Supervisory " +
      "Body under the UNFCCC, which approves the methodologies projects may use. Relevant here because credits " +
      "issued under it are a distinct instrument from the voluntary-market credits the offsets ledger currently " +
      `models, and would need their own treatment. ${SEED_CAVEAT}`,
    sourceUrl: "https://unfccc.int/process-and-meetings/the-paris-agreement/article-64-mechanism",
    nextMilestone: null,
  },
  {
    regime: "DIGITAL_PRODUCT_PASSPORT",
    title: "EU Digital Product Passport under the Ecodesign for Sustainable Products Regulation",
    summary:
      "The ESPR introduces a digital record of product sustainability information, rolled out product group by " +
      "product group through delegated acts. Relevant here because the per-SKU footprint work is the nearest " +
      "existing surface, and a passport would need product data at a depth this platform does not yet collect — a " +
      `full LCA rather than an allocation. ${SEED_CAVEAT}`,
    sourceUrl: "https://commission.europa.eu/energy-climate-change-environment/standards-tools-and-labels/products-labelling-rules-and-requirements/ecodesign-sustainable-products-regulation_en",
    nextMilestone: null,
  },
  {
    regime: "TNFD",
    title: "TNFD nature-related disclosure recommendations",
    summary:
      "The Taskforce on Nature-related Financial Disclosures publishes a voluntary framework for reporting " +
      "nature-related dependencies, impacts, risks and opportunities, structured like TCFD. Relevant here because " +
      "it is the nature-side counterpart to the climate frameworks already built, and because ESRS E4 " +
      `(biodiversity) already asks adjacent questions. ${SEED_CAVEAT}`,
    sourceUrl: "https://tnfd.global/",
    nextMilestone: null,
  },
];

export const REGULATORY_REGIME_LABELS: Record<string, string> = {
  ICVCM: "ICVCM",
  ARTICLE_6_PACM: "Article 6 / PACM",
  DIGITAL_PRODUCT_PASSPORT: "Digital Product Passport",
  TNFD: "TNFD",
  OTHER: "Other",
};

export const REGULATORY_STATUS_LABELS: Record<string, string> = {
  MONITORING: "Monitoring",
  DRAFT_PUBLISHED: "Draft published",
  ADOPTED: "Adopted",
  IN_FORCE: "In force",
  SUPERSEDED: "Superseded",
};

/**
 * How long an entry may go unverified before the admin list flags it.
 *
 * Ninety days is short enough that a regime moving between quarters gets
 * noticed and long enough not to nag. The flag is the whole reason
 * lastVerifiedAt is separate from updatedAt.
 */
export const WATCH_STALE_AFTER_DAYS = 90;

export const isWatchEntryStale = (lastVerifiedAt: Date, now: Date = new Date()): boolean =>
  (now.getTime() - lastVerifiedAt.getTime()) / 86_400_000 > WATCH_STALE_AFTER_DAYS;
