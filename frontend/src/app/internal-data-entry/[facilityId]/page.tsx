"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ClipboardList, Factory, Loader2, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { InternalRoute } from "@/components/auth/internal-route";
import { AppHeader } from "@/components/layout/app-header";
import { internalDataEntryApi, documentsApi, ApiError } from "@/lib/api";
import type { InternalFacilityDetail, FacilityDocument } from "@/lib/types";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function EvidenceUploadForm({
  facilityId,
  entries,
  onUploaded,
}: {
  facilityId: string;
  entries: InternalFacilityDetail["entries"];
  onUploaded: () => void;
}) {
  const submitted = entries.filter((e) => e.status === "SUBMITTED");
  const [selectedId, setSelectedId] = useState(submitted[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <p className="mt-1 text-xs text-muted-foreground">
        Bills and invoices backing a submitted activity data period — PDF, JPG, PNG, or WEBP, up to 10MB.
      </p>

      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {submitted.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Submit activity data for a reporting period before uploading evidence.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="evidence-period">Reporting period</Label>
            <Select id="evidence-period" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {submitted.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.periodStart && e.periodEnd ? `${formatDate(e.periodStart)} – ${formatDate(e.periodEnd)}` : e.id}
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

function InternalFacilityDetailContent() {
  const params = useParams<{ facilityId: string }>();
  const router = useRouter();
  const [data, setData] = useState<InternalFacilityDetail | null>(null);
  const [evidenceDocs, setEvidenceDocs] = useState<FacilityDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = () => {
    internalDataEntryApi
      .getFacility(params.facilityId)
      .then(setData)
      .catch(() => {
        // Not assigned to this facility (or it doesn't exist) — bounce back
        // to the facility list rather than showing a dead-end error page.
        router.replace("/internal-data-entry");
      });
    documentsApi
      .list(params.facilityId)
      .then(({ documents }) => setEvidenceDocs(documents.filter((d) => d.documentType === "SUPPORTING_EVIDENCE")))
      .catch(() => setError("Couldn't load documents for this facility."));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params.facilityId]);

  const handleDownloadEvidence = async (doc: FacilityDocument) => {
    setDownloadingId(doc.id);
    try {
      await documentsApi.download(params.facilityId, doc.id, doc.fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't download this document.");
    } finally {
      setDownloadingId(null);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      </div>
    );
  }

  const { facility, entries } = data;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/internal-data-entry" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Back to assigned facilities
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
              <Factory className="h-5 w-5 text-teal-500" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{facility.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {facility.company.name} · {facility.sector}
              </p>
            </div>
          </div>
          <Link href={`/internal-data-entry/${facility.id}/data-entry/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add activity data
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mt-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <h2 className="mt-10 mb-4 text-lg font-semibold">Activity data</h2>
        {entries.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <ClipboardList className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No activity data yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add fuel, material, and production data for a reporting period.
            </p>
            <Link href={`/internal-data-entry/${facility.id}/data-entry/new`} className="mt-2">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Add activity data
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const isDraft = entry.status === "DRAFT";
              const card = (
                <Card
                  className={
                    isDraft
                      ? "flex flex-col gap-3 p-5 transition-colors hover:border-teal-500/40 sm:flex-row sm:items-center sm:justify-between"
                      : "flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  }
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-muted" />
                      {formatDate(entry.periodStart)} – {formatDate(entry.periodEnd)}
                      {isDraft ? <DraftBadge /> : <SubmittedBadge />}
                      {entry.evidencePending && <EvidencePendingBadge />}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.productCategory ?? "Untitled"} ·{" "}
                      {entry.productionQuantityT != null ? entry.productionQuantityT.toLocaleString("en-IN") : "—"} t produced
                    </p>
                  </div>
                  {!isDraft && <span className="text-xs text-muted">Submitted · last updated {fmtDateTime(entry.updatedAt)}</span>}
                </Card>
              );
              return isDraft ? (
                <Link key={entry.id} href={`/internal-data-entry/${facility.id}/data-entry/${entry.id}/edit`}>
                  {card}
                </Link>
              ) : (
                <div key={entry.id}>{card}</div>
              );
            })}
          </div>
        )}

        <h2 className="mt-10 mb-4 text-lg font-semibold">Supporting Evidence</h2>
        <EvidenceUploadForm facilityId={facility.id} entries={entries} onUploaded={load} />

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
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.reportingPeriod} · Uploaded {fmtDateTime(doc.createdAt)}
                  </p>
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
      </main>
    </div>
  );
}

export default function InternalFacilityDetailPage() {
  return (
    <InternalRoute>
      <InternalFacilityDetailContent />
    </InternalRoute>
  );
}
