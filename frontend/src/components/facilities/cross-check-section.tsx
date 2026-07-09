"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { crossCheckApi, ApiError } from "@/lib/api";
import { ACTIVITY_DATA_FIELDS, formatFieldValue } from "@/lib/activity-data-fields";
import type { CrossCheckEntry, CrossCheckDocument, CrossCheckReview } from "@/lib/types";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const isImageFile = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.has(ext);
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtPeriod = (entry: CrossCheckEntry) =>
  entry.periodStart && entry.periodEnd
    ? `${new Date(entry.periodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(
        entry.periodEnd,
      ).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
    : entry.id;

function DocumentThumbnail({ document, fetchDocumentBlob }: { document: CrossCheckDocument; fetchDocumentBlob: (documentId: string) => Promise<Blob> }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isImageFile(document.fileName)) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    fetchDocumentBlob(document.id)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  if (!isImageFile(document.fileName)) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-surface-border bg-surface-raised text-xs text-muted-foreground">
        Couldn&apos;t load preview
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
        <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={objectUrl} alt={document.fileName} className="h-32 w-full rounded-lg border border-surface-border object-cover" />;
}

function StatusBadge({ status }: { status: "MATCHED" | "MISMATCH" }) {
  if (status === "MATCHED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Matched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
      <XCircle className="h-2.5 w-2.5" />
      Mismatch
    </span>
  );
}

function CrossCheckCard({
  entry,
  document,
  fetchDocumentBlob,
  onDownloadDocument,
  onReviewed,
}: {
  entry: CrossCheckEntry;
  document: CrossCheckDocument;
  fetchDocumentBlob: (documentId: string) => Promise<Blob>;
  onDownloadDocument: (documentId: string, fileName: string) => Promise<void>;
  onReviewed: (documentId: string, review: CrossCheckReview) => void;
}) {
  const [reReviewing, setReReviewing] = useState(false);
  const [showMismatchNote, setShowMismatchNote] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<"MATCHED" | "MISMATCH" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = document.crossCheckReview;
  const isReviewed = review && review.status !== "NOT_REVIEWED" && !reReviewing;

  const submit = async (status: "MATCHED" | "MISMATCH") => {
    setError(null);
    setIsSubmitting(status);
    try {
      const { review: updated } = await crossCheckApi.review(entry.id, document.id, {
        status,
        notes: status === "MISMATCH" ? notes : undefined,
      });
      onReviewed(document.id, updated);
      setReReviewing(false);
      setShowMismatchNote(false);
      setNotes("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this review. Please try again.");
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownloadDocument(document.id, document.fileName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Left — submitted values */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Submitted values</p>
          <div className="mt-2 grid gap-3 grid-cols-2">
            {ACTIVITY_DATA_FIELDS.filter((f) => entry[f.key] != null).map((f) => (
              <Field key={f.key} label={f.label} value={formatFieldValue(f.key, entry[f.key])} />
            ))}
            {entry.fuelEntries.map((fuel) => (
              <Field
                key={fuel.id}
                label={`Fuel — ${fuel.fuelType}`}
                value={`${formatFieldValue("quantity", fuel.quantity)} ${fuel.unit}`}
              />
            ))}
          </div>
        </div>

        {/* Right — linked document */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Linked document</p>
          <div className="mt-2">
            <DocumentThumbnail document={document} fetchDocumentBlob={fetchDocumentBlob} />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{document.fileName}</p>
                <p className="text-xs text-muted-foreground">Uploaded {fmtDateTime(document.createdAt)}</p>
              </div>
              <Button size="sm" variant="secondary" isLoading={downloading} onClick={handleDownload}>
                View document
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-surface-border pt-4">
        {isReviewed && review ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <StatusBadge status={review.status as "MATCHED" | "MISMATCH"} />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {review.reviewer?.name ?? "Unknown reviewer"} · {review.reviewedAt ? fmtDateTime(review.reviewedAt) : ""}
              </p>
              {review.status === "MISMATCH" && review.notes && <p className="mt-1 text-xs text-foreground/90">&ldquo;{review.notes}&rdquo;</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setReReviewing(true)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Re-review
            </Button>
          </div>
        ) : (
          <div>
            {!showMismatchNote ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-success/30 bg-success/10 text-success hover:bg-success/20"
                  isLoading={isSubmitting === "MATCHED"}
                  onClick={() => submit("MATCHED")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Confirm Match
                </Button>
                <Button size="sm" variant="danger" onClick={() => setShowMismatchNote(true)}>
                  <XCircle className="h-3.5 w-3.5" />
                  Flag Mismatch
                </Button>
                {reReviewing && (
                  <Button size="sm" variant="ghost" onClick={() => setReReviewing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain the discrepancy…"
                  rows={2}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-danger/60"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={notes.trim().length === 0}
                    isLoading={isSubmitting === "MISMATCH"}
                    onClick={() => submit("MISMATCH")}
                  >
                    Submit Mismatch
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowMismatchNote(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </Card>
  );
}

export function CrossCheckSection({
  facilityId,
  fetchDocumentBlob,
  onDownloadDocument,
}: {
  facilityId: string;
  fetchDocumentBlob: (documentId: string) => Promise<Blob>;
  onDownloadDocument: (documentId: string, fileName: string) => Promise<void>;
}) {
  const [entries, setEntries] = useState<CrossCheckEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    crossCheckApi
      .listForFacility(facilityId)
      .then(({ entries }) => setEntries(entries))
      .catch(() => setError("Couldn't load cross-check reviews."));
  }, [facilityId]);

  const handleReviewed = (activityDataId: string, documentId: string, review: CrossCheckReview) => {
    setEntries((prev) =>
      prev
        ? prev.map((entry) =>
            entry.id === activityDataId
              ? { ...entry, documents: entry.documents.map((d) => (d.id === documentId ? { ...d, crossCheckReview: review } : d)) }
              : entry,
          )
        : prev,
    );
  };

  return (
    <div id="cross-check">
      <h2 className="mt-8 text-lg font-semibold">Cross-Check</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manually confirm each submitted value against its supporting document, or flag a mismatch.
      </p>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {!entries && !error && (
        <div className="mt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      )}

      {entries && entries.length === 0 && (
        <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
          No submissions with linked documents to cross-check yet.
        </Card>
      )}

      {entries && entries.length > 0 && (
        <div className="mt-4 space-y-6">
          {entries.map((entry) => (
            <div key={entry.id}>
              <p className="text-sm font-medium text-foreground">{fmtPeriod(entry)}</p>
              <div className="mt-2 space-y-3">
                {entry.documents.map((document, idx) => (
                  <div key={document.id}>
                    {entry.documents.length > 1 && (
                      <p className="mb-1 text-xs text-muted-foreground">
                        Document {idx + 1} of {entry.documents.length}
                      </p>
                    )}
                    <CrossCheckCard
                      entry={entry}
                      document={document}
                      fetchDocumentBlob={fetchDocumentBlob}
                      onDownloadDocument={onDownloadDocument}
                      onReviewed={(documentId, review) => handleReviewed(entry.id, documentId, review)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
