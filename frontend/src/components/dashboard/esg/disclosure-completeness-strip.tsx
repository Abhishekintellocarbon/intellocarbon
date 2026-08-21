import Link from "next/link";
import { ArrowRight, BadgeCheck, FileBarChart, Globe2, Landmark, Network, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { EsgFrameworkCompleteness } from "@/lib/types";

/**
 * Top-level "where do we stand" strip for the unified ESG Overview — one card
 * per framework, each showing X of Y required disclosures complete and acting
 * as the drill-down into that framework's own page.
 *
 * The counts come straight from the backend's checklist
 * (data/esgDisclosureChecklist.ts); nothing is derived here, so the strip and
 * the framework pages can't disagree about what "complete" means.
 */

type FrameworkKey = "brsr" | "issb" | "gri" | "csrd" | "cdp" | "scope3";

interface FrameworkCard {
  key: FrameworkKey;
  title: string;
  subtitle: string;
  icon: typeof FileBarChart;
  href: string;
  /** What the Y in "X of Y" counts, for the caption under the bar. */
  unitLabel: string;
}

const FRAMEWORKS: FrameworkCard[] = [
  {
    key: "brsr",
    title: "BRSR Core",
    subtitle: "SEBI",
    icon: FileBarChart,
    href: "/esg/brsr",
    unitLabel: "attributes",
  },
  {
    key: "issb",
    title: "ISSB IFRS S1/S2",
    subtitle: "IFRS Foundation",
    icon: BadgeCheck,
    href: "/esg/issb",
    unitLabel: "core pillars",
  },
  {
    key: "gri",
    title: "GRI Standards",
    subtitle: "Global Reporting Initiative",
    icon: Globe2,
    href: "/esg/gri",
    // Not "topics": which Topic Standards apply is decided per facility by its
    // materiality assessment, so the fixed thing to count is GRI 1's reporting
    // requirements — see GRI_REPORTING_REQUIREMENTS on the backend.
    unitLabel: "reporting requirements",
  },
  {
    key: "csrd",
    title: "CSRD / ESRS",
    subtitle: "EFRAG",
    icon: Landmark,
    href: "/esg/csrd",
    // Not "standards": which of the ten topical standards apply is an output
    // of the company's own double materiality assessment, so the fixed thing
    // to count is the frame around it — the same reasoning as GRI above. See
    // CSRD_REPORTING_REQUIREMENTS on the backend.
    unitLabel: "reporting requirements",
  },
  {
    key: "cdp",
    title: "CDP Climate Change",
    subtitle: "CDP",
    icon: ScrollText,
    href: "/esg/cdp",
    // Modules, because that is how the questionnaire is structured and how a
    // responder works through it. Optional modules are excluded, so this is
    // completeness of the response — never a CDP score or band.
    unitLabel: "required modules",
  },
  {
    key: "scope3",
    title: "Scope 3",
    subtitle: "GHG Protocol",
    icon: Network,
    href: "/esg/brsr",
    unitLabel: "required categories",
  },
];

function CompletenessBar({ complete, total }: { complete: number; total: number }) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  // Teal once everything's in, amber while it's partial, muted at zero — the
  // same three-state tone language the CCTS intensity gauge uses.
  const tone = pct === 100 ? "bg-teal-500" : pct > 0 ? "bg-[#F5A623]" : "bg-surface-border";

  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DisclosureCompletenessStrip({
  completeness,
  currentFyLabel,
}: {
  completeness: Record<FrameworkKey, EsgFrameworkCompleteness>;
  currentFyLabel: string;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Disclosure status</h2>
        <p className="text-xs text-muted-foreground">Current financial year: {currentFyLabel}</p>
      </div>

      {/* Three across, not four. With four frameworks a 4-column row was
          exactly full; at six it would leave a two-card orphan row against
          four above it. Three divides six evenly, and the cards are content
          cards rather than a fixed-width strip, so the extra width per card
          goes to the outstanding-requirement list rather than to whitespace. */}
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FRAMEWORKS.map((framework) => {
          const status = completeness[framework.key];
          const outstanding = status.requirements.filter((r) => !r.complete);

          return (
            <Link key={framework.key} href={framework.href} className="group">
              <Card className="flex h-full flex-col rounded-[12px] p-6 transition-colors group-hover:border-teal-500/40">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                    <framework.icon className="h-4 w-4 text-teal-500" />
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <h3 className="mt-4 font-medium">{framework.title}</h3>
                <p className="text-xs text-muted-foreground">{framework.subtitle}</p>

                {status.total > 0 ? (
                  <>
                    <p className="mt-4 text-2xl font-semibold text-foreground">
                      {status.complete}
                      <span className="text-base font-normal text-muted-foreground"> of {status.total}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {framework.unitLabel} complete
                      {status.periodLabel ? ` — ${status.periodLabel}` : ""}
                    </p>
                    <CompletenessBar complete={status.complete} total={status.total} />
                    <p className="mt-3 flex-1 text-xs text-muted">
                      {outstanding.length === 0
                        ? "All required disclosures recorded."
                        : `Outstanding: ${outstanding.map((r) => r.label).join(", ")}`}
                    </p>
                  </>
                ) : (
                  // total === 0 is only reachable for Scope 3, when this
                  // company's sector makes none of the 5 calculable
                  // categories mandatory. Saying "0 of 0 complete" would
                  // read as a failure, so say what's actually true.
                  <p className="mt-4 flex-1 text-sm text-muted-foreground">
                    No categories are mandatory for your sector — disclose any that are material to you.
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
