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
import { griApi, ApiError } from "@/lib/api";
import { getGriTopic } from "@/lib/gri-standards";
import type { GriReport, GriMetrics, GriContentIndex } from "@/lib/types";

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

function GriReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);

  const [report, setReport] = useState<GriReport | null>(null);
  const [metrics, setMetrics] = useState<GriMetrics | null>(null);
  const [contentIndex, setContentIndex] = useState<GriContentIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    griApi
      .getReport(params.id, period)
      .then((data) => {
        setReport(data.report);
        setMetrics(data.metrics);
        setContentIndex(data.contentIndex);
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
      await griApi.downloadPdf(report.id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't generate the report.");
    } finally {
      setDownloading(false);
    }
  };

  const inAccordance = contentIndex?.claimLevel === "IN_ACCORDANCE";
  const materialTopics = report?.materialTopics.filter((t) => t.isMaterial).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)) ?? [];

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

        {report && metrics && contentIndex && (
          <>
            <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-xl font-semibold">GRI Standards Report — {period}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metrics.accordance.materialTopicCount} material topics · {contentIndex.reportedCount} disclosures
                  reported
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/facilities/${params.id}/gri/${encodeURIComponent(period)}/edit`}>
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
                    {inAccordance ? "In accordance with the GRI Standards" : "With reference to the GRI Standards"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{contentIndex.claimStatement}</p>
                  <p className="mt-2 text-xs text-muted-foreground">GRI 1 used: {contentIndex.gri1Version}</p>
                </div>
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Material topics</h2>
              <div className="mt-3 space-y-2">
                {materialTopics.map((topic) => {
                  const meta = getGriTopic(topic.topicCode);
                  return (
                    <div
                      key={topic.topicCode}
                      className="flex items-center justify-between gap-3 rounded-xl border border-surface-border px-4 py-2.5"
                    >
                      <span className="text-sm">
                        <span className="text-muted-foreground">#{topic.rank} · {meta?.label}</span> {meta?.title}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {topic.significanceScore != null ? topic.significanceScore.toFixed(2) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Derived figures</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Reused from this facility&apos;s existing activity data — not re-entered for this report.
              </p>
              <div className="mt-3">
                <Metric label="Scope 1 (direct, AR5)" value={fmtCo2e(metrics.ghg.scope1Co2e)} />
                <Metric label="Scope 2 (location-based)" value={fmtCo2e(metrics.ghg.scope2LocationBasedCo2e)} />
                <Metric label="Scope 3 (value chain)" value={fmtCo2e(metrics.ghg.scope3Co2e)} />
                <Metric label="Water withdrawal" value={metrics.water.hasData ? `${fmt(metrics.water.withdrawalTotalMl, 3)} ML` : "No water inventory"} />
                <Metric label="Water consumption" value={metrics.water.hasData ? `${fmt(metrics.water.consumptionTotalMl, 3)} ML` : "No water inventory"} />
                <Metric label="Waste generated" value={metrics.waste.hasData ? `${fmt(metrics.waste.totalGeneratedT, 3)} t` : "Not disclosed"} />
                <Metric
                  label="Recordable injury rate"
                  value={
                    metrics.safety.recordableInjuryRate != null
                      ? `${fmt(metrics.safety.recordableInjuryRate, 3)} per ${metrics.safety.rateBasisHours.toLocaleString("en-IN")} hrs`
                      : "Not calculable"
                  }
                />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">GRI content index</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Required by GRI 1. The full index with page references is in the PDF.
              </p>
              <div className="mt-3">
                <Metric label="Disclosures reported" value={String(contentIndex.reportedCount)} />
                <Metric label="Disclosures omitted with a stated reason" value={String(contentIndex.omittedCount)} />
                <Metric label="Topics assessed and not material" value={String(contentIndex.excludedTopics.length)} />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function GriReportPage() {
  return (
    <ProtectedRoute>
      <GriReportContent />
    </ProtectedRoute>
  );
}
