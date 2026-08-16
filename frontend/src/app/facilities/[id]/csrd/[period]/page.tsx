"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Loader2, Pencil, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { csrdApi, ApiError } from "@/lib/api";
import { getEsrsStandard } from "@/lib/esrs-standards";
import type { CsrdReport, CsrdMetrics, CsrdDisclosureIndex } from "@/lib/types";

const fmt = (n: number | null, digits = 2) =>
  n == null ? "Not disclosed" : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtCo2e = (n: number | null) => (n == null ? "Not disclosed" : `${fmt(n)} tCO2e`);

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function CsrdReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [report, setReport] = useState<CsrdReport | null>(null);
  const [metrics, setMetrics] = useState<CsrdMetrics | null>(null);
  const [disclosureIndex, setContentIndex] = useState<CsrdDisclosureIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    csrdApi
      .getReport(params.id, period)
      .then((data) => {
        setReport(data.report);
        setMetrics(data.metrics);
        setContentIndex(data.disclosureIndex);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError ? err.message : "Couldn't load this GRI report — it may not be submitted yet.",
        ),
      );
  }, [params.id, period]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    setActionError(null);
    try {
      await csrdApi.downloadPdf(report.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't generate the report.");
    } finally {
      setDownloading(false);
    }
  };

  const inAccordance = disclosureIndex?.claimLevel === "ESRS_CONFORMANT";
  const materialTopics = report?.materialTopics.filter((t) => t.isMaterial).sort((a, b) => Math.max(b.impactScore ?? 0, b.financialScore ?? 0) - Math.max(a.impactScore ?? 0, a.financialScore ?? 0)) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/facilities/${params.id}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to facility
        </Link>

        {loadError && (
          <div className="mt-6">
            <Alert variant="error">{loadError}</Alert>
          </div>
        )}

        {!report && !loadError && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {report && metrics && disclosureIndex && (
          <>
            <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-semibold">GRI Standards Report — {period}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metrics.conformity.materialStandardCount} material standards · {disclosureIndex.reportedCount} disclosures
                  reported
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/facilities/${params.id}/csrd/${encodeURIComponent(period)}/edit`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit / resubmit
                  </Button>
                </Link>
                <Button size="sm" onClick={handleDownload} isLoading={downloading}>
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
              </div>
            </div>

            {actionError && (
              <div className="mt-4">
                <Alert variant="error">{actionError}</Alert>
              </div>
            )}

            <Card className="mt-6 p-6">
              <div className="flex items-start gap-3">
                {inAccordance ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                )}
                <div>
                  <h2 className="font-medium">
                    {inAccordance ? "Conformant with ESRS" : "Prepared with reference to ESRS"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{disclosureIndex.claimStatement}</p>
                  <p className="mt-2 text-xs text-muted-foreground">ESRS (2026)</p>
                </div>
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Material standards</h2>
              <div className="mt-3 space-y-2">
                {materialTopics.map((topic) => {
                  const meta = getEsrsStandard(topic.standardCode);
                  return (
                    <div
                      key={topic.standardCode}
                      className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-2.5"
                    >
                      <span className="text-sm">
                        <span className="text-muted-foreground">{meta?.label}</span> {meta?.title}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {topic.impactMaterial && topic.financialMaterial ? "Both" : topic.impactMaterial ? "Impact" : "Financial"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Derived figures</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reused from this facility&apos;s existing activity data — not re-entered for this statement.
              </p>
              <div className="mt-3">
                <Metric label="Scope 1 (E1-6, AR5)" value={fmtCo2e(metrics.rollup.scope1Tco2e)} />
                <Metric label="Scope 2 (E1-6a, location-based)" value={fmtCo2e(metrics.rollup.scope2LocationTco2e)} />
                <Metric label="Scope 3 (E1-6c)" value={fmtCo2e(metrics.rollup.scope3Tco2e)} />
                <Metric label="Water withdrawal" value={metrics.rollup.hasWaterData ? `${fmt(metrics.rollup.waterWithdrawalM3, 0)} m3` : "No water inventory"} />
                <Metric label="Water consumption" value={metrics.rollup.hasWaterData ? `${fmt(metrics.rollup.waterConsumptionM3, 0)} m3` : "No water inventory"} />
                <Metric label="Waste generated" value={metrics.rollup.wasteGeneratedTonnes != null ? `${fmt(metrics.rollup.wasteGeneratedTonnes ?? 0, 3)} t` : "Not disclosed"} />
                <Metric
                  label="Total energy (E1-5)"
                  value={`${fmt(metrics.rollup.totalEnergyMwh, 3)} MWh`}
                />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">ESRS disclosure index</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Required by ESRS 2 IRO-2. The full index with page references is in the PDF.
              </p>
              <div className="mt-3">
                <Metric label="Disclosures reported" value={String(disclosureIndex.reportedCount)} />
                <Metric label="Disclosures omitted with a stated reason" value={String(disclosureIndex.omittedCount)} />
                <Metric label="Standards assessed and not material" value={String(disclosureIndex.excludedStandards.length)} />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function CsrdReportPage() {
  return (
    <ProtectedRoute>
      <CsrdReportContent />
    </ProtectedRoute>
  );
}
