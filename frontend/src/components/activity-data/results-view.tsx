"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Download, Info, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { activityDataApi, ApiError } from "@/lib/api";
import type { ActivityData, VerificationRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

const fmt = (n: number, digits = 3) => n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtInt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function ResultsView({ facilityId, dataId }: { facilityId: string; dataId: string }) {
  const router = useRouter();
  const [entry, setEntry] = useState<ActivityData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [downloading, setDownloading] = useState<"cbam" | "ccts" | null>(null);

  useEffect(() => {
    activityDataApi
      .get(facilityId, dataId)
      .then(({ entry }) => setEntry(entry))
      .catch(() => setLoadError("Couldn't load this activity data entry."));
  }, [facilityId, dataId]);

  const handleDelete = async () => {
    if (!confirm("Delete this activity data entry and its calculation results?")) return;
    setDeleting(true);
    try {
      await activityDataApi.remove(facilityId, dataId);
      router.push(`/facilities/${facilityId}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't delete this entry.");
      setDeleting(false);
    }
  };

  const handleSubmitForVerification = async () => {
    setSubmittingVerification(true);
    setActionError(null);
    try {
      const { request } = await activityDataApi.submitForVerification(facilityId, dataId);
      setEntry((prev) => (prev ? { ...prev, verificationRequest: request } : prev));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't submit for verification.");
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleDownload = async (type: "cbam" | "ccts") => {
    setDownloading(type);
    setActionError(null);
    try {
      await activityDataApi.downloadReport(facilityId, dataId, type);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't generate the report.");
    } finally {
      setDownloading(null);
    }
  };

  if (loadError) return <p className="text-sm text-danger">{loadError}</p>;
  if (!entry) return null;

  const result = entry.calculationResult;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href={`/facilities/${facilityId}`}
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to facility
          </Link>
          <h1 className="text-xl font-semibold">
            {entry.productCategory} · {formatDate(entry.periodStart)} – {formatDate(entry.periodEnd)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry.productionQuantityT.toLocaleString("en-IN")} tonnes produced
          </p>
        </div>
        <div className="flex gap-2">
          {result && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload("cbam")}
                isLoading={downloading === "cbam"}
              >
                <Download className="h-3.5 w-3.5" />
                CBAM report
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload("ccts")}
                isLoading={downloading === "ccts"}
              >
                <Download className="h-3.5 w-3.5" />
                CCTS report
              </Button>
            </>
          )}
          <Button variant="danger" size="sm" onClick={handleDelete} isLoading={deleting}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete entry
          </Button>
        </div>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {!result ? (
        <Alert variant="info">This entry hasn&apos;t been calculated yet.</Alert>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <ScoreCard
              scheme="CBAM"
              title="Specific Embedded Emissions (SEE)"
              value={result.specificEmbeddedEmissionsCbam}
              unit={`${result.breakdown.seeUnit ?? "tCO2e/t"} product`}
              total={result.totalEmissionsCbamAr5}
              gwp="IPCC AR5"
              accent="teal"
            />
            <ScoreCard
              scheme="CCTS"
              title="GHG Intensity"
              value={result.ghgIntensityCcts}
              unit={`${result.breakdown.seeUnit ?? "tCO2e/t"} product`}
              total={result.totalEmissionsCctsAr4}
              gwp="IPCC AR2/BUR3"
              accent="blue"
            />
          </div>

          <Alert variant="info">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Calculated using indicative Tier-1 default emission factors (IPCC 2006 Guidelines and
                typical industry values). Verify against current CBAM Implementing Regulation default
                values and India GHG Programme factors before regulatory submission.
              </span>
            </div>
          </Alert>

          <VerificationPanel
            verification={entry.verificationRequest ?? null}
            onSubmit={handleSubmitForVerification}
            isSubmitting={submittingVerification}
          />

          <Card className="p-6">
            <h2 className="font-medium">Emissions by category</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Direct combustion is shown under both GWP tables — CBAM (AR5) and CCTS (AR2/BUR3).
            </p>
            <div className="mt-5 space-y-4">
              <CategoryBar
                label="Direct combustion (fuels)"
                valueAr5={result.directCombustionCo2eAr5}
                valueAr4={result.directCombustionCo2eAr4}
                max={result.totalEmissionsCbamAr5}
              />
              <CategoryBar label="Process emissions (calcination / feedstock)" valueAr5={result.directProcessCo2e} valueAr4={result.directProcessCo2e} max={result.totalEmissionsCbamAr5} single />
              {result.directPfcCo2eAr5 > 0 && (
                <CategoryBar label="PFC emissions (aluminium anode effects)" valueAr5={result.directPfcCo2eAr5} valueAr4={result.directPfcCo2eAr4} max={result.totalEmissionsCbamAr5} />
              )}
              {result.directN2oProcessCo2eAr5 > 0 && (
                <CategoryBar label="N2O process emissions (nitric acid)" valueAr5={result.directN2oProcessCo2eAr5} valueAr4={result.directN2oProcessCo2eAr4} max={result.totalEmissionsCbamAr5} />
              )}
              <CategoryBar label="Precursor materials (embedded)" valueAr5={result.directPrecursorCo2e} valueAr4={result.directPrecursorCo2e} max={result.totalEmissionsCbamAr5} single />
              <CategoryBar label="Electricity (indirect)" valueAr5={result.indirectElectricityCo2e} valueAr4={result.indirectElectricityCo2e} max={result.totalEmissionsCbamAr5} single />
              <CategoryBar label="Steam (indirect)" valueAr5={result.indirectSteamCo2e} valueAr4={result.indirectSteamCo2e} max={result.totalEmissionsCbamAr5} single />
            </div>
            <div className="mt-5 flex items-center gap-4 border-t border-surface-border pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-500" /> CBAM (AR5)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" /> CCTS (AR2/BUR3)
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-medium">GWP tables applied</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <GwpCard table={result.breakdown.gwpTables.ar5} usedFor="CBAM" />
              <GwpCard table={result.breakdown.gwpTables.ar4} usedFor="CCTS" />
            </div>
          </Card>

          {result.breakdown.fuels.length > 0 && (
            <Card className="overflow-hidden p-0">
              <h2 className="p-6 pb-0 font-medium">Fuel combustion detail</h2>
              <div className="overflow-x-auto">
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-y border-surface-border text-left text-xs text-muted-foreground">
                      <th className="px-6 py-2.5 font-medium">Fuel</th>
                      <th className="px-3 py-2.5 font-medium">Quantity</th>
                      <th className="px-3 py-2.5 font-medium">CO2 (t)</th>
                      <th className="px-3 py-2.5 font-medium">CH4 (kg)</th>
                      <th className="px-3 py-2.5 font-medium">N2O (kg)</th>
                      <th className="px-3 py-2.5 font-medium">CO2e AR5 (t)</th>
                      <th className="px-6 py-2.5 font-medium">CO2e AR2/BUR3 (t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakdown.fuels.map((f, i) => (
                      <tr key={i} className="border-b border-surface-border last:border-0">
                        <td className="px-6 py-2.5">{f.label}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{fmtInt(f.quantity)} {f.unit}</td>
                        <td className="px-3 py-2.5">{fmt(f.co2Tonnes)}</td>
                        <td className="px-3 py-2.5">{fmt(f.ch4Kg)}</td>
                        <td className="px-3 py-2.5">{fmt(f.n2oKg)}</td>
                        <td className="px-3 py-2.5 font-medium text-teal-500">{fmt(f.co2eAr5)}</td>
                        <td className="px-6 py-2.5 font-medium text-blue-400">{fmt(f.co2eAr4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {result.breakdown.processMaterials.length > 0 && (
            <DetailTable
              title="Process material detail"
              columns={["Material", "Quantity (t)", "Factor (tCO2/t)", "CO2 (t)"]}
              rows={result.breakdown.processMaterials.map((m) => [
                m.label,
                fmtInt(m.quantityTonnes),
                `${m.emissionFactorUsed}${m.isOverride ? " (override)" : ""}`,
                fmt(m.co2Tonnes),
              ])}
            />
          )}

          {result.breakdown.precursors.length > 0 && (
            <DetailTable
              title="Precursor material detail"
              columns={["Material", "Quantity (t)", "Factor (tCO2e/t)", "CO2e (t)"]}
              rows={result.breakdown.precursors.map((p) => [
                p.label,
                fmtInt(p.quantityTonnes),
                `${p.emissionFactorUsed}${p.isOverride ? " (override)" : ""}`,
                fmt(p.co2eTonnes),
              ])}
            />
          )}

          {result.breakdown.calcination && (
            <DetailTable
              title="Calcination detail (cement)"
              columns={["Limestone input (t)", "Factor (tCO2/t CaCO3)", "Conversion fraction", "CO2 (t)"]}
              rows={[[
                fmtInt(result.breakdown.calcination.limestoneInputTonnes),
                String(result.breakdown.calcination.emissionFactorUsed),
                String(result.breakdown.calcination.clinkerConversionFraction),
                fmt(result.breakdown.calcination.co2Tonnes),
              ]]}
            />
          )}

          {result.breakdown.fertilizerFeedstock && (
            <DetailTable
              title="Natural gas feedstock detail (fertilizer)"
              columns={["Feedstock ('000 Nm3)", "Factor (tCO2/'000 Nm3)", "CO2 (t)"]}
              rows={[[
                fmtInt(result.breakdown.fertilizerFeedstock.naturalGasFeedstockNm3),
                String(result.breakdown.fertilizerFeedstock.emissionFactorUsed),
                fmt(result.breakdown.fertilizerFeedstock.co2Tonnes),
              ]]}
            />
          )}

          {result.breakdown.pfc && (
            <DetailTable
              title="PFC emissions detail (aluminium)"
              columns={["Gas", "Quantity (t)", "GWP (CBAM/AR5)", "GWP (CCTS/AR2)", "CO2e (t)"]}
              rows={[
                [
                  "CF4",
                  fmt(result.breakdown.pfc.cf4Tonnes, 3),
                  String(result.breakdown.pfc.gwpAr5.cf4 ?? "—"),
                  String(result.breakdown.pfc.gwpAr4.cf4 ?? "—"),
                  fmt(result.breakdown.pfc.cf4Tonnes * (result.breakdown.pfc.gwpAr5.cf4 ?? 0)),
                ],
                [
                  "C2F6",
                  fmt(result.breakdown.pfc.c2f6Tonnes, 3),
                  String(result.breakdown.pfc.gwpAr5.c2f6 ?? "—"),
                  String(result.breakdown.pfc.gwpAr4.c2f6 ?? "—"),
                  fmt(result.breakdown.pfc.c2f6Tonnes * (result.breakdown.pfc.gwpAr5.c2f6 ?? 0)),
                ],
              ]}
            />
          )}

          {result.breakdown.n2oProcess && (
            <DetailTable
              title="N2O process emissions detail (fertilizer)"
              columns={["N2O emitted (t)", "Abatement (%)", "Net N2O (t)", "CO2e AR5 (t)", "CO2e AR2/BUR3 (t)"]}
              rows={[[
                fmt(result.breakdown.n2oProcess.n2oTonnes, 3),
                fmt(result.breakdown.n2oProcess.abatementFactorPct, 1),
                fmt(result.breakdown.n2oProcess.netN2oTonnes, 3),
                fmt(result.breakdown.n2oProcess.co2eAr5),
                fmt(result.breakdown.n2oProcess.co2eAr4),
              ]]}
            />
          )}

          {result.breakdown.hydrogen && (
            <DetailTable
              title="Hydrogen production route"
              columns={["Route", "CCS capture (%)", "Purity (%)", "By-product O2 (t)"]}
              rows={[[
                result.breakdown.hydrogen.route.replace(/_/g, " "),
                result.breakdown.hydrogen.ccsCaptureRatePct != null ? fmt(result.breakdown.hydrogen.ccsCaptureRatePct, 1) : "—",
                result.breakdown.hydrogen.hydrogenPurityPct != null ? fmt(result.breakdown.hydrogen.hydrogenPurityPct, 1) : "—",
                result.breakdown.hydrogen.byproductOxygenTonnes != null ? fmtInt(result.breakdown.hydrogen.byproductOxygenTonnes) : "—",
              ]]}
            />
          )}

          {result.breakdown.electricitySector && (
            <DetailTable
              title="Electricity generation & export"
              columns={["Generated (MWh)", "Exported to EU (MWh)", "Own use (MWh)", "Line losses (MWh)"]}
              rows={[[
                result.breakdown.electricitySector.electricityGeneratedMwh != null ? fmtInt(result.breakdown.electricitySector.electricityGeneratedMwh) : "—",
                result.breakdown.electricitySector.electricityExportedEuMwh != null ? fmtInt(result.breakdown.electricitySector.electricityExportedEuMwh) : "—",
                result.breakdown.electricitySector.ownUseElectricityMwh != null ? fmtInt(result.breakdown.electricitySector.ownUseElectricityMwh) : "—",
                result.breakdown.electricitySector.lineLossMwh != null ? fmtInt(result.breakdown.electricitySector.lineLossMwh) : "—",
              ]]}
            />
          )}

          <DetailTable
            title="Indirect emissions detail"
            columns={["Source", "Quantity", "Factor", "CO2e (t)"]}
            rows={[
              [
                "Grid electricity",
                `${fmtInt(result.breakdown.electricity.gridMwh)} MWh`,
                `${result.breakdown.electricity.emissionFactorUsed} tCO2/MWh${result.breakdown.electricity.isOverride ? " (override)" : ""}`,
                fmt(result.breakdown.electricity.co2eTonnes),
              ],
              [
                "Imported steam",
                `${fmtInt(result.breakdown.steam.gj)} GJ`,
                `${result.breakdown.steam.emissionFactorUsed} tCO2/GJ${result.breakdown.steam.isOverride ? " (override)" : ""}`,
                fmt(result.breakdown.steam.co2eTonnes),
              ],
            ]}
          />
        </>
      )}
    </div>
  );
}

const VERIFICATION_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-surface-raised text-muted-foreground border-surface-border",
  IN_REVIEW: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  APPROVED: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  REJECTED: "bg-danger/10 text-danger border-danger/30",
};

function VerificationPanel({
  verification,
  onSubmit,
  isSubmitting,
}: {
  verification: VerificationRequest | null;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal-500" />
        <h2 className="font-medium">Independent verification</h2>
      </div>

      {!verification ? (
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Submit this report to an independent verifier for review before relying on it for regulatory
            submission.
          </p>
          <Button size="sm" onClick={onSubmit} isLoading={isSubmitting}>
            Submit for verification
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              VERIFICATION_STATUS_STYLES[verification.status],
            )}
          >
            <BadgeCheck className="h-3 w-3" />
            {verification.status.replace(/_/g, " ")}
          </span>
          {verification.status === "APPROVED" && (
            <p className="text-sm text-foreground/90">
              Approved by {verification.verifier?.name ?? "an independent verifier"}
              {verification.verifierOrg ? ` (${verification.verifierOrg})` : ""}
              {verification.decidedAt
                ? ` on ${new Date(verification.decidedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                : ""}
              .
            </p>
          )}
          {verification.status === "REJECTED" && (
            <p className="text-sm text-foreground/90">
              Rejected by {verification.verifier?.name ?? "an independent verifier"}
              {verification.comments ? `: "${verification.comments}"` : "."}
            </p>
          )}
          {verification.status === "PENDING" && (
            <p className="text-sm text-muted-foreground">Waiting for a verifier to claim this request.</p>
          )}
          {verification.status === "IN_REVIEW" && (
            <p className="text-sm text-muted-foreground">
              Currently under review{verification.verifier?.name ? ` by ${verification.verifier.name}` : ""}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function ScoreCard({
  scheme,
  title,
  value,
  unit,
  total,
  gwp,
  accent,
}: {
  scheme: string;
  title: string;
  value: number;
  unit: string;
  total: number;
  gwp: string;
  accent: "teal" | "blue";
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            accent === "teal" ? "bg-teal-500/10 text-teal-500" : "bg-blue-500/10 text-blue-400",
          )}
        >
          {scheme}
        </span>
        <span className="text-xs text-muted">{gwp} GWP</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">
        {fmt(value)} <span className="text-base font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Total: {fmtInt(total)} tCO2e for this period</p>
    </Card>
  );
}

function CategoryBar({
  label,
  valueAr5,
  valueAr4,
  max,
  single,
}: {
  label: string;
  valueAr5: number;
  valueAr4: number;
  max: number;
  single?: boolean;
}) {
  const pct5 = max > 0 ? Math.min(100, (valueAr5 / max) * 100) : 0;
  const pct4 = max > 0 ? Math.min(100, (valueAr4 / max) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {single ? fmtInt(valueAr5) : `${fmtInt(valueAr5)} / ${fmtInt(valueAr4)}`} tCO2e
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct5}%` }} />
        </div>
        {!single && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct4}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function GwpCard({ table, usedFor }: { table: { label: string; source: string; co2: number; ch4: number; n2o: number }; usedFor: string }) {
  return (
    <div className="rounded-xl border border-surface-border p-4">
      <p className="text-sm font-medium">
        {table.label} <span className="text-xs font-normal text-muted-foreground">— used for {usedFor}</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{table.source}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-surface-raised py-2">
          <p className="text-muted-foreground">CO2</p>
          <p className="font-medium">{table.co2}</p>
        </div>
        <div className="rounded-lg bg-surface-raised py-2">
          <p className="text-muted-foreground">CH4</p>
          <p className="font-medium">{table.ch4}</p>
        </div>
        <div className="rounded-lg bg-surface-raised py-2">
          <p className="text-muted-foreground">N2O</p>
          <p className="font-medium">{table.n2o}</p>
        </div>
      </div>
    </div>
  );
}

function DetailTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <Card className="overflow-hidden p-0">
      <h2 className="p-6 pb-0 font-medium">{title}</h2>
      <div className="overflow-x-auto">
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-y border-surface-border text-left text-xs text-muted-foreground">
              {columns.map((c, i) => (
                <th key={c} className={cn("px-3 py-2.5 font-medium", i === 0 && "px-6", i === columns.length - 1 && "px-6")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-surface-border last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className={cn("px-3 py-2.5", j === 0 && "px-6", j === row.length - 1 && "px-6 font-medium")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
