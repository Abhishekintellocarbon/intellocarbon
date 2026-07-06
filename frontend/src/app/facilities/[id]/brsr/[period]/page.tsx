"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, Pencil } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { brsrApi, ApiError } from "@/lib/api";
import type { BrsrCoreReport, BrsrCoreMetrics } from "@/lib/types";

const fmt = (n: number | null, digits = 2) =>
  n == null ? "Not disclosed" : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const fmtPct = (n: number | null) => (n == null ? "Not disclosed" : `${fmt(n, 1)}%`);

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function BrsrReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);
  const [report, setReport] = useState<BrsrCoreReport | null>(null);
  const [metrics, setMetrics] = useState<BrsrCoreMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    brsrApi
      .getReport(params.id, period)
      .then(({ report, metrics }) => {
        setReport(report);
        setMetrics(metrics);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load this BRSR Core report — it may not be submitted yet.",
        ),
      );
  }, [params.id, period]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    setActionError(null);
    try {
      await brsrApi.downloadPdf(report.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't generate the report.");
    } finally {
      setDownloading(false);
    }
  };

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

        {report && metrics && (
          <>
            <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-semibold">BRSR Core Report — {period}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rolled up from {metrics.ghg.activityDataCount} submitted activity data{" "}
                  {metrics.ghg.activityDataCount === 1 ? "entry" : "entries"}.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/facilities/${params.id}/brsr/${encodeURIComponent(period)}/edit`}>
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
              <h2 className="font-medium">GHG footprint</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reused from this facility&apos;s existing CBAM/CCTS activity data (CCTS/AR2-BUR3 basis).
              </p>
              <div className="mt-3">
                <Metric label="Scope 1 (direct, AR2/BUR3)" value={`${fmt(metrics.ghg.scope1Co2e)} tCO2e`} />
                <Metric label="Scope 2 (indirect)" value={`${fmt(metrics.ghg.scope2Co2e)} tCO2e`} />
                <Metric label="Total GHG emissions" value={`${fmt(metrics.ghg.totalCo2e)} tCO2e`} />
                <Metric
                  label="Intensity per rupee of turnover"
                  value={metrics.ghg.intensityPerRupeeTurnover == null ? "Not disclosed" : `${fmt(metrics.ghg.intensityPerRupeeTurnover * 1e7, 4)} tCO2e/Rs. Cr`}
                />
                <Metric
                  label="Intensity per unit of production"
                  value={metrics.ghg.intensityPerUnitProduction == null ? "Not available" : `${fmt(metrics.ghg.intensityPerUnitProduction, 4)} tCO2e/t`}
                />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Water & waste</h2>
              <div className="mt-3">
                <Metric label="Water consumption" value={metrics.water.consumptionKl == null ? "Not disclosed" : `${fmt(metrics.water.consumptionKl)} KL`} />
                <Metric label="Waste recovery rate" value={fmtPct(metrics.waste.recoveryRatePct)} />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Energy</h2>
              <div className="mt-3">
                <Metric label="Renewable share" value={fmtPct(metrics.energy.renewablePct)} />
                <Metric label="Total energy consumption" value={metrics.energy.totalGj == null ? "Not disclosed" : `${fmt(metrics.energy.totalGj)} GJ`} />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Social attributes</h2>
              <div className="mt-3">
                <Metric label="Women in workforce" value={fmtPct(report.womenInWorkforcePct)} />
                <Metric label="Procurement from MSMEs" value={fmtPct(report.procurementFromMsmePct)} />
                <Metric label="Top-10 supplier concentration" value={fmtPct(report.purchasesFromTop10SuppliersPct)} />
                <Metric label="Complaints resolved" value={fmtPct(report.consumerComplaintsResolvedPct)} />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function BrsrReportPage() {
  return (
    <ProtectedRoute>
      <BrsrReportContent />
    </ProtectedRoute>
  );
}
