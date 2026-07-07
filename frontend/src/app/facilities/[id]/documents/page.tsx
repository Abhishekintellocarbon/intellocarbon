"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { reportsApi, ApiError } from "@/lib/api";
import type { GeneratedReport, GeneratedReportType } from "@/lib/types";

const REPORT_TYPE_LABEL: Record<GeneratedReportType, string> = {
  CBAM: "CBAM Communication Package",
  CCTS: "CCTS GHG Intensity Report",
  BRSR: "BRSR Core Report",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function DocumentsContent() {
  const params = useParams<{ id: string }>();
  const [reports, setReports] = useState<GeneratedReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .list(params.id)
      .then(({ reports }) => setReports(reports))
      .catch(() => setError("Couldn't load documents. Please refresh the page."));
  }, [params.id]);

  const handleDownload = async (report: GeneratedReport) => {
    setDownloadingId(report.id);
    try {
      await reportsApi.downloadPdf(params.id, report.id, report.pdfPath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download this document.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Every compliance report generated for this facility.</p>
        <Link href={`/facilities/${params.id}`} className="mt-2 inline-block text-sm text-teal-500 hover:text-teal-400">
          Back to facility
        </Link>

        {error && <p className="mt-8 text-sm text-danger">{error}</p>}

        {!reports && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {reports && reports.length === 0 && (
          <Card className="mt-8 flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <FileText className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No documents yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Reports you generate from this facility&apos;s dashboard will appear here.
            </p>
            <Link href={`/facilities/${params.id}/dashboard`} className="mt-2">
              <Button size="sm">Go to dashboard</Button>
            </Link>
          </Card>
        )}

        {reports && reports.length > 0 && (
          <div className="mt-8 space-y-3">
            {reports.map((report) => (
              <Card key={report.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                    <FileText className="h-4 w-4 text-teal-500" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{REPORT_TYPE_LABEL[report.reportType]}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {report.period} · Generated {fmtDateTime(report.generatedAt)}
                    </p>
                    {report.document?.verified && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-teal-500">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={downloadingId === report.id}
                  onClick={() => handleDownload(report)}
                  className="shrink-0"
                >
                  Download
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <DocumentsContent />
    </ProtectedRoute>
  );
}
