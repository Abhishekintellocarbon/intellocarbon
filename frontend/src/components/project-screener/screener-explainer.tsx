import { Landmark, Globe2 } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * The explainer that has to come before the questionnaire.
 *
 * Its job is to separate two things that are constantly conflated in the
 * Indian market: the CCTS compliance mechanism, which applies to formally
 * obligated entities reducing their own emissions intensity, and the voluntary
 * carbon market, where projects generate credits for someone else to buy.
 * A visitor who arrives thinking this tool screens them for CCTS should leave
 * this section knowing it does not.
 */
export function ScreenerExplainer() {
  return (
    <section className="grid gap-5 md:grid-cols-2">
      <Card className="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
          <Landmark className="h-4 w-4 text-teal-500" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#E8F0F7]">
          CCTS is a compliance mechanism — and this is not it
        </h2>
        <p className="mt-2.5 text-sm text-[#8AA0B4]">
          India&apos;s Carbon Credit Trading Scheme is administered by the Bureau of Energy Efficiency and applies
          only to formally obligated entities. Those entities reduce the emissions intensity of their own
          operations against a target notified to them individually, and earn or surrender Carbon Credit
          Certificates on that basis.
        </p>
        <p className="mt-3 text-sm text-[#8AA0B4]">
          It is an obligation that attaches to a company, not an opportunity that attaches to a project.
          <span className="text-[#E8F0F7]"> This screener does not assess CCTS obligation or CCC eligibility.</span>{" "}
          If that is what you are looking for, the CCTS position tools are a different part of the platform.
        </p>
      </Card>

      <Card className="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
          <Globe2 className="h-4 w-4 text-teal-500" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#E8F0F7]">The voluntary carbon market is a separate world</h2>
        <p className="mt-2.5 text-sm text-[#8AA0B4]">
          Dozens of project types generate credits here — renewable energy, biochar, biogas and landfill gas
          capture, forestry and afforestation, enhanced rock weathering, industrial energy efficiency, and many
          more. Credits are issued against published methodologies by registries: India&apos;s own ICM domestic
          track, or international registries such as Verra and Gold Standard.
        </p>
        <p className="mt-3 text-sm text-[#8AA0B4]">
          Which registry fits, and which of the market&apos;s four categories a project falls into, depends on what
          the project actually does. That is what this tool gives an indicative read on.
        </p>
      </Card>

      <Card className="p-6 md:col-span-2">
        <h2 className="text-lg font-semibold text-[#E8F0F7]">What Intellocarbon does here</h2>
        <p className="mt-2.5 text-sm text-[#8AA0B4]">
          Indicative screening only.{" "}
          <span className="text-[#E8F0F7]">
            Intellocarbon does not issue, verify, or rate carbon credits.
          </span>{" "}
          Issuance sits with the registries, verification with accredited third-party bodies, and ratings with the
          agencies that publish them. What this page does is tell you which direction is worth investigating
          before you spend money finding out.
        </p>
      </Card>
    </section>
  );
}
