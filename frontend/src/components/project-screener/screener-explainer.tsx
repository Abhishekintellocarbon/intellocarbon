import { Landmark, Globe2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * The explainer that has to come before the questionnaire.
 *
 * Its job is to separate two things that are constantly conflated in the
 * Indian market: the CCTS compliance mechanism, which applies to formally
 * obligated entities reducing their own emissions intensity, and the voluntary
 * carbon market, where projects generate credits for someone else to buy. A
 * visitor who arrives thinking this tool screens them for CCTS should leave
 * this section knowing it does not.
 *
 * Deliberately compact — one card, three columns, no paragraph longer than a
 * few lines. It was originally three full-height cards, which pushed the
 * actual questionnaire below the fold; the two boundary statements that matter
 * (this is not CCTS screening, and Intellocarbon does not issue/verify/rate
 * credits) are emphasised inline instead of being given their own card each.
 * The longer treatment now sits below the tool, for readers who want it.
 */
export function ScreenerExplainer() {
  return (
    <Card className="p-6">
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <span className="flex items-center gap-2 text-sm font-semibold text-[#E8F0F7]">
            <Landmark className="h-4 w-4 shrink-0 text-teal-500" />
            CCTS is a separate, compliance mechanism
          </span>
          <p className="mt-2 text-sm text-[#8AA0B4]">
            Administered by the Bureau of Energy Efficiency, it applies only to formally obligated entities
            reducing their own emissions intensity against an individually notified target.{" "}
            <span className="text-[#E8F0F7]">This screener does not assess CCTS obligation or CCC eligibility.</span>
          </p>
        </div>

        <div>
          <span className="flex items-center gap-2 text-sm font-semibold text-[#E8F0F7]">
            <Globe2 className="h-4 w-4 shrink-0 text-teal-500" />
            The voluntary market is a different world
          </span>
          <p className="mt-2 text-sm text-[#8AA0B4]">
            Renewable energy, biochar, biogas and landfill gas, forestry, enhanced rock weathering, industrial
            efficiency and more — credited against published methodologies by registries: India&apos;s ICM domestic
            track, or Verra and Gold Standard internationally.
          </p>
        </div>

        <div>
          <span className="flex items-center gap-2 text-sm font-semibold text-[#E8F0F7]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-teal-500" />
            What this page does
          </span>
          <p className="mt-2 text-sm text-[#8AA0B4]">
            Indicative screening only.{" "}
            <span className="text-[#E8F0F7]">Intellocarbon does not issue, verify, or rate carbon credits.</span> It
            points you at the direction worth investigating before you spend money finding out.
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * The fuller treatment of the same two mechanisms, placed *below* the tool.
 * Nothing here is required to use the screener — it is for the reader who has
 * their result and wants to understand the distinction properly.
 */
export function ScreenerBackground() {
  return (
    <section className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[#E8F0F7]">Why CCTS and this screening are not the same thing</h2>
        <p className="mt-2.5 text-sm text-[#8AA0B4]">
          Under CCTS, an obligated entity is given a GHG emissions intensity target notified to it individually.
          Beat the target and it earns Carbon Credit Certificates; miss it and it must buy them or pay
          environmental compensation. The obligation attaches to the company, applies whether or not it wants to
          participate, and is settled annually against verified data.
        </p>
        <p className="mt-3 text-sm text-[#8AA0B4]">
          A voluntary market project is the opposite arrangement. Nobody is obliged to develop one. The credits it
          generates are sold to buyers who choose to purchase them, and eligibility is decided by a registry
          against a published methodology rather than by a regulator against a notified target.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-[#E8F0F7]">What actually decides eligibility</h2>
        <p className="mt-2.5 text-sm text-[#8AA0B4]">
          A registry assessing your project against a specific methodology — not this page. That assessment covers
          the baseline scenario, additionality, the monitoring plan, leakage, and for removals the permanence and
          reversal-risk provisions. Each of those can end a project&apos;s eligibility on its own.
        </p>
        <p className="mt-3 text-sm text-[#8AA0B4]">
          The screening above is a starting direction: which registry track is worth approaching, and which of the
          market&apos;s four categories the project sits in. Treat it as the question list for a proper assessment,
          not as its answer.
        </p>
      </Card>
    </section>
  );
}
