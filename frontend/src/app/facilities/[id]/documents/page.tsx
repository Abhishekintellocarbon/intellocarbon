"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { activityDataApi, documentsApi, reportsApi, ApiError } from "@/lib/api";
import type { ActivityData, FacilityDocument, GeneratedReport, GeneratedReportType } from "@/lib/types";

const REPORT_TYPE_LABEL: Record<GeneratedReportType, string> = {
  CBAM: "CBAM Communication Package",
  CCTS: "CCTS GHG Intensity Report",
  BRSR: "BRSR Core Report",
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDateShort = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function EvidenceUploadForm({ facilityId, onUploaded }: { facilityId: string; onUploaded: () => void }) {
  const [entries, setEntries] = useState<ActivityData[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    activityDataApi.list(facilityId).then(({ entries }) => {
      const submitted = entries.filter((e) => e.status === "SUBMITTED");
      setEntries(submitted);
      setSelectedId((prev) => prev || submitted[0]?.id || "");
    });
  }, [facilityId]);

  const handleUpload = async () => {
    if (!selectedId || !file) return;
    setError(null);
    setIsUploading(true);
    try {
      await documentsApi.uploadEvidence(facilityId, selectedId, file);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload this document.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-foreground">Upload supporting evidence</h3>
      <p className="mt-1 text-xs text-muted-foreground">Bills and invoices backing a submitted activity data period — PDF, JPG, PNG, or WEBP, up to 10MB.</p>

      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {entries && entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Submit activity data for a reporting period before uploading evidence.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="evidence-period">Reporting period</Label>
            <Select id="evidence-period" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {entries?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.periodStart && e.periodEnd ? `${fmtDateShort(e.periodStart)} – ${fmtDateShort(e.periodEnd)}` : e.id}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="evidence-file">File</Label>
            <input
              id="evidence-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
            />
          </div>
          <Button size="sm" onClick={handleUpload} isLoading={isUploading} disabled={!file || !selectedId}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Button>
        </div>
      )}
    </Card>
  );
}

function DocumentsContent() {
  const params = useParams<{ id: string }>();
  const [reports, setReports] = useState<GeneratedReport[] | null>(null);
  const [evidenceDocs, setEvidenceDocs] = useState<FacilityDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadEvidence = () => {
    documentsApi
      .list(params.id)
      .then(({ documents }) => setEvidenceDocs(documents.filter((d) => d.documentType === "SUPPORTING_EVIDENCE")));
  };

  useEffect(() => {
    reportsApi
      .list(params.id)
      .then(({ reports }) => setReports(reports))
      .catch(() => setError("Couldn't load documents. Please refresh the page."));
    loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleDownloadReport = async (report: GeneratedReport) => {
    setDownloadingId(report.id);
    try {
      await reportsApi.downloadPdf(params.id, report.id, report.pdfPath);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download this document.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadEvidence = async (doc: FacilityDocument) => {
    setDownloadingId(doc.id);
    try {
      await documentsApi.download(params.id, doc.id, doc.fileName);
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
        <p className="mt-1.5 text-sm text-muted-foreground">Supporting evidence and generated compliance reports for this facility.</p>
        <Link href={`/facilities/${params.id}`} className="mt-2 inline-block text-sm text-teal-500 hover:text-teal-400">
          Back to facility
        </Link>

        {error && <p className="mt-8 text-sm text-danger">{error}</p>}

        {/* Supporting evidence */}
        <h2 className="mt-8 text-lg font-semibold">Supporting Evidence</h2>
        <div className="mt-4">
          <EvidenceUploadForm facilityId={params.id} onUploaded={loadEvidence} />
        </div>

        {!evidenceDocs ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          </div>
        ) : evidenceDocs.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No supporting documents uploaded yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {evidenceDocs.map((doc) => (
              <Card key={doc.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                    <FileText className="h-4 w-4 text-teal-500" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.reportingPeriod} · Uploaded {fmtDateTime(doc.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={downloadingId === doc.id}
                  onClick={() => handleDownloadEvidence(doc)}
                  className="shrink-0"
                >
                  Download
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Generated reports */}
        <h2 className="mt-10 text-lg font-semibold">Generated Reports</h2>

        {!reports && !error && (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          </div>
        )}

        {reports && reports.length === 0 && (
          <Card className="mt-4 flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <FileText className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No reports yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Reports you generate from this facility&apos;s dashboard will appear here.
            </p>
            <Link href={`/facilities/${params.id}/dashboard`} className="mt-2">
              <Button size="sm">Go to dashboard</Button>
            </Link>
          </Card>
        )}

        {reports && reports.length > 0 && (
          <div className="mt-4 space-y-3">
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
                  onClick={() => handleDownloadReport(report)}
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
