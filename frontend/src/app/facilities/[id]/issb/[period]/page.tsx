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
import { issbApi, ApiError } from "@/lib/api";
import type { IssbS1S2Report, IssbS1S2Metrics } from "@/lib/types";

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

function NarrativeBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-surface-border py-3 text-sm last:border-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-foreground">{value && value.trim() ? value : "Not yet disclosed."}</p>
    </div>
  );
}

function IssbReportContent() {
  const params = useParams<{ id: string; period: string }>();
  const period = decodeURIComponent(params.period);
  const [report, setReport] = useState<IssbS1S2Report | null>(null);
  const [metrics, setMetrics] = useState<IssbS1S2Metrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    issbApi
      .getReport(params.id, period)
      .then(({ report, metrics }) => {
        setReport(report);
        setMetrics(metrics);
      })
      .catch((err) =>
        setLoadError(
          err instanceof ApiError
            ? err.message
            : "Couldn't load this ISSB report — it may not be submitted yet.",
        ),
      );
  }, [params.id, period]);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    setActionError(null);
    try {
      await issbApi.downloadPdf(report.id);
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
                <h1 className="text-xl font-semibold">ISSB IFRS S1 & S2 Report — {period}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Scope 1/2 rolled up from {metrics.ghg.activityDataCount} submitted activity data{" "}
                  {metrics.ghg.activityDataCount === 1 ? "entry" : "entries"}.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/facilities/${params.id}/issb/${encodeURIComponent(period)}/edit`}>
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
              <h2 className="font-medium">Metrics & Targets — GHG emissions</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Scope 1 and 2 reused from this facility&apos;s existing CBAM/CCTS activity data (AR5 basis).
              </p>
              <div className="mt-3">
                <Metric label="Scope 1 (direct, AR5)" value={fmtCo2e(metrics.ghg.scope1Co2e)} />
                <Metric label="Scope 2 (indirect)" value={fmtCo2e(metrics.ghg.scope2Co2e)} />
                <Metric label="Scope 3 (value chain, disclosed)" value={fmtCo2e(metrics.ghg.scope3Co2e)} />
                <Metric label="Total GHG emissions" value={fmtCo2e(metrics.ghg.totalCo2e)} />
                <Metric
                  label="Change vs. baseline"
                  value={metrics.targets.changeFromBaselinePct == null ? "Not calculable" : `${fmt(metrics.targets.changeFromBaselinePct, 1)}%`}
                />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Governance</h2>
              <div className="mt-3">
                <NarrativeBlock label="Oversight by the governance body" value={report.governanceBodyOversight} />
                <NarrativeBlock label="Management's role" value={report.managementRole} />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Strategy</h2>
              <div className="mt-3">
                <NarrativeBlock label="Climate-related risks and opportunities" value={report.climateRisksOpportunities} />
                <NarrativeBlock label="Effect on business model and value chain" value={report.businessModelImpact} />
                <NarrativeBlock label="Effect on financial position, performance and cash flows" value={report.financialEffects} />
                <NarrativeBlock label="Climate resilience — scenario analysis" value={report.scenarioAnalysisResilience} />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Risk Management</h2>
              <div className="mt-3">
                <NarrativeBlock label="Risk identification and assessment process" value={report.riskIdentificationProcess} />
                <NarrativeBlock label="Risk management and prioritisation process" value={report.riskManagementProcess} />
                <NarrativeBlock label="Integration into overall risk management" value={report.riskIntegrationOverall} />
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <h2 className="font-medium">Targets and transition plan</h2>
              <div className="mt-3">
                <Metric label="Baseline year" value={report.baselineYear != null ? String(report.baselineYear) : "Not disclosed"} />
                <Metric label="Baseline emissions" value={fmtCo2e(report.baselineEmissionsTco2e)} />
                <Metric label="Target year" value={report.targetYear != null ? String(report.targetYear) : "Not disclosed"} />
                <NarrativeBlock label="Target description" value={report.targetDescription} />
                <NarrativeBlock label="Transition plan" value={report.transitionPlan} />
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function IssbReportPage() {
  return (
    <ProtectedRoute>
      <IssbReportContent />
    </ProtectedRoute>
  );
}
