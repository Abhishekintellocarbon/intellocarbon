import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, Boxes, Check, Clock, Droplets, FileBarChart, Gauge, Globe2, Landmark, Leaf, LineChart, Network, Recycle, ScrollText, ShieldCheck, Target, Truck, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/intellocalc/marketing-header";
import { ToolFooter } from "@/components/intellocalc/tool-footer";

export const metadata: Metadata = {
  title: "ESG Disclosure Bundle — BRSR Core, ISSB, GRI, CSRD/ESRS, CDP, Scope 3 | Intellocarbon",
  description:
    "One subscription for BRSR Core, ISSB IFRS S1/S2, GRI Standards 2021, CSRD/ESRS, CDP Climate Change and Scope 3 emissions — all live today.",
};

interface BundleItem {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: "live" | "soon";
}

// No price figure on this page — pricing lives on /billing, which is behind
// auth by design: logged-out visitors don't see figures anywhere on this site.
// Do not reintroduce a hardcoded price label here.

const BUNDLE_ITEMS: BundleItem[] = [
  { icon: FileBarChart, name: "BRSR Core", status: "live" },
  { icon: BadgeCheck, name: "ISSB IFRS S1/S2", status: "live" },
  { icon: Network, name: "Scope 3 Value Chain", status: "live" },
  { icon: Droplets, name: "Water Footprint (ISO 14046)", status: "live" },
  { icon: Leaf, name: "Voluntary Offsets Tracking", status: "live" },
  { icon: Globe2, name: "GRI Standards 2021", status: "live" },
  { icon: Landmark, name: "CSRD / ESRS", status: "live" },
  { icon: ScrollText, name: "CDP Climate Change", status: "live" },
];

/**
 * Capabilities that come with the same bundle, kept in their own list rather
 * than mixed into BUNDLE_ITEMS above.
 *
 * The distinction is real and worth preserving: the items above are disclosure
 * frameworks a company reports *under*, each with its own standard-setter and
 * report output. These are trackers and indicators that read the same data.
 * Flattening eighteen chips into one grid would imply, say, EcoVadis readiness
 * is a reporting framework on a par with GRI, which it is not.
 *
 * Two names are deliberately not the ones a feature list would reach for:
 *
 *   - "Reduction targets & progress", not "SBTi alignment". Intellocarbon
 *     does not validate targets and has no relationship with the Science
 *     Based Targets initiative; the tracker records a self-stated target and
 *     measures it against submitted emissions. Calling it SBTi alignment
 *     would claim a validation nobody performed.
 *   - "EcoVadis readiness", never a predicted score. It maps existing data
 *     against the four EcoVadis themes and reports completeness per theme.
 *     EcoVadis scores EcoVadis submissions; this only shows what is ready.
 */
const ALSO_INCLUDED: BundleItem[] = [
  { icon: Recycle, name: "Waste & circularity rate", status: "live" },
  { icon: Zap, name: "Energy mix trend", status: "live" },
  { icon: Target, name: "Reduction targets & progress", status: "live" },
  { icon: BadgeCheck, name: "Renewable energy certificates", status: "live" },
  { icon: ShieldCheck, name: "Governance disclosures", status: "live" },
  { icon: Truck, name: "Supplier ESG scorecard", status: "live" },
  { icon: BarChart3, name: "Sector benchmarking", status: "live" },
  { icon: LineChart, name: "Net-zero trajectory", status: "live" },
  { icon: Boxes, name: "Product footprint per SKU", status: "live" },
  { icon: Gauge, name: "EcoVadis readiness", status: "live" },
];

interface MarketRow {
  market: string;
  framework: string;
  status: "live" | "soon";
}

// Illustrative, not exhaustive — the goal is orienting a company to "which
// framework does my market actually require," not a complete legal survey.
const MARKET_ROWS: MarketRow[] = [
  { market: "India", framework: "BRSR Core (SEBI)", status: "live" },
  { market: "Global investors / IFRS jurisdictions", framework: "ISSB IFRS S1/S2", status: "live" },
  { market: "Global stakeholders (voluntary, most widely used)", framework: "GRI Standards 2021", status: "live" },
  { market: "European Union (above the Omnibus thresholds)", framework: "CSRD / ESRS", status: "live" },
  { market: "United States (SEC / state climate rules)", framework: "Climate disclosure rules", status: "soon" },
  { market: "Global supply chains (buyer-driven)", framework: "CDP Climate Change", status: "live" },
];

function StatusChip({ status }: { status: "live" | "soon" }) {
  return status === "live" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-teal-500">
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-raised px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
      <Clock className="h-3 w-3" />
      Coming Soon
    </span>
  );
}

export default function EsgHub() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background lg:pr-[240px]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-radial-glow" />

      <MarketingHeader />

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
          One subscription. Every ESG framework.
        </span>

        <h1 className="mt-6 text-[36px] font-semibold leading-tight text-balance sm:text-[48px]">
          <span className="text-gradient">ESG</span> reporting on Intellocarbon
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg">
          BRSR Core, ISSB IFRS S1/S2, GRI Standards 2021, CSRD/ESRS, CDP Climate Change and Scope 3 emissions are
          all live today, in one bundled subscription.
        </p>

        {/* Unified ESG Disclosure Bundle */}
        <Card className="mx-auto mt-14 max-w-2xl p-8 text-left">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">ESG Disclosure Bundle</h2>
            <Link href="/billing" className="text-sm font-semibold text-teal-500 hover:underline">
              See pricing
            </Link>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Priced above CBAM and CCTS because it covers more ground: Scope 3 value-chain emissions on top of Scope
            1/2, several disclosure frameworks rather than one, and a single data entry that feeds all of them — no
            re-entering the same activity data per framework.
          </p>

          {/* Stated plainly wherever CSRD is offered: most companies reading
              this are well below the Omnibus thresholds and must not take a
              CSRD module as evidence of a filing obligation. */}
          <p className="mt-3 text-sm text-muted-foreground">
            CSRD is mandatory only above 1,000 employees and EUR 450 million net turnover, first reporting for
            financial years beginning in 2027 (Omnibus I, Directive (EU) 2026/470). Below those thresholds you are
            outside mandatory scope — the module is here for voluntary reporting and for answering a customer&apos;s
            value-chain request, not because you are required to file.
          </p>

          {/* The same discipline for CDP, whose failure mode is worse than
              CSRD's: CSRD at least has thresholds, whereas CDP is not a
              regulator at all and nothing about the name says so. */}
          <p className="mt-3 text-sm text-muted-foreground">
            CDP is voluntary and buyer-driven — there is no law behind it and no statutory deadline. You need it when
            a specific customer or investor asks you to respond, and the scope and deadline are theirs, not ours. The
            module prepares your response; CDP responses are submitted on CDP&apos;s own platform, so nothing here
            files on your behalf.
          </p>

          {/* GRI, CSRD and CDP are the frameworks here whose scope isn't
              obvious from the name. These notes live in the shared bundle copy
              rather than as per-item annotations, so no single framework in
              the list below carries more visual weight than the others. */}
          <p className="mt-3 text-sm text-muted-foreground">
            GRI is the full 2021 Standards, not a subset: the Universal Standards, a materiality assessment that
            determines which Topic Standards apply to each facility, and the content index GRI requires alongside
            the report.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BUNDLE_ITEMS.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/60 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 shrink-0 text-teal-500" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <StatusChip status={item.status} />
              </div>
            ))}
          </div>

          {/* Same chip markup as the frameworks above, under its own heading —
              included in the bundle, not priced separately, and not presented
              as a reporting framework. */}
          <p className="mt-7 text-sm font-medium">Also included, on the same subscription</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Trackers and indicators that read the emissions, energy, waste and governance data you have already
            entered. No additional charge and no separate module to buy.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ALSO_INCLUDED.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised/60 px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 shrink-0 text-teal-500" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <StatusChip status={item.status} />
              </div>
            ))}
          </div>

          {/* The two claims on this page that could overstate, stated plainly
              in the same place they are offered — the discipline already
              applied to CSRD and CDP above. */}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Reduction targets are self-reported and measured against your own submitted emissions. Intellocarbon does
            not validate targets and has no relationship with the Science Based Targets initiative. EcoVadis readiness
            reports how complete your data is against the four EcoVadis themes — it is not a predicted EcoVadis score,
            and only EcoVadis scores an EcoVadis submission.
          </p>

          <Link href="/signup" className="mt-7 block">
            <Button size="lg" className="w-full">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-2.5 text-center text-xs text-muted-foreground">
            Create an account or{" "}
            <Link href="/login" className="font-medium text-teal-500 hover:underline">
              log in
            </Link>{" "}
            to see pricing and start with BRSR Core — ISSB IFRS S1/S2, GRI, CSRD/ESRS, CDP and Scope 3 are available
            from the same facility dashboard.
          </p>
        </Card>

        {/* Lightweight global mandate comparison */}
        <div className="mx-auto mt-16 max-w-2xl text-left">
          <h2 className="text-center text-lg font-semibold">Which framework does your market actually require?</h2>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            A quick orientation, not a complete legal survey — check with counsel for your specific obligations.
          </p>
          <div className="mt-6 space-y-2.5">
            {MARKET_ROWS.map((row) => (
              <div
                key={row.market}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-border bg-surface px-4 py-3"
              >
                <span className="text-sm font-medium">{row.market}</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-muted-foreground">{row.framework}</span>
                  <StatusChip status={row.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="mx-auto mt-16 max-w-xl p-8">
          <h2 className="text-lg font-semibold">Already tracking CBAM or CCTS with us?</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The ESG Disclosure Bundle reuses the same activity data you&apos;ve already submitted — no double entry.
          </p>
          <Link href="/esg/brsr" className="mt-5 inline-block">
            <Button>
              <Check className="h-4 w-4" />
              Start your ESG disclosure
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </Card>
      </main>

      <div className="relative z-10">
        <ToolFooter />
      </div>
    </div>
  );
}
