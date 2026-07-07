"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { VerifierRoute } from "@/components/auth/verifier-route";
import { AppHeader } from "@/components/layout/app-header";
import { verifierApi } from "@/lib/api";
import { ACTIVITY_DATA_FIELDS, formatFieldValue } from "@/lib/activity-data-fields";
import type { VerifierFacilityDetail, VerificationMethodologyNote } from "@/lib/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtNum = (n: number, digits = 4) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });
const fmtEur = (n: number) => `€${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function MethodologyNote({ note }: { note: VerificationMethodologyNote }) {
  return (
    <div className="mt-2 rounded-lg border border-surface-border bg-surface-raised/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">Formula</p>
      <p className="mt-0.5 text-xs text-foreground/90">{note.formula}</p>
      <p className="mt-2 text-xs font-medium text-muted-foreground">Source</p>
      <p className="mt-0.5 text-xs text-foreground/90">{note.source}</p>
    </div>
  );
}

function VerifierFacilityDetailContent() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<VerifierFacilityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    verifierApi
      .getFacility(params.id)
      .then(setData)
      .catch(() => setError("Couldn't load this facility. It may not be assigned to you."));
  }, [params.id]);

  const handleDownload = async (documentId: string, fileName: string) => {
    setDownloadingId(documentId);
    try {
      await verifierApi.downloadDocument(params.id, documentId, fileName);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/verifier/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {!data && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {data && (
          <>
            <h1 className="mt-4 text-2xl font-semibold">{data.facility.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.facility.company.name} · {data.facility.company.sector} · Owner: {data.facility.company.owner.email}
            </p>

            <h2 className="mt-8 text-lg font-semibold">Activity data submissions</h2>
            {data.activityData.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">No submitted activity data yet.</Card>
            ) : (
              <div className="mt-4 space-y-6">
                {data.activityData.map((entry) => (
                  <Card key={entry.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {entry.periodStart && entry.periodEnd ? `${fmtDate(entry.periodStart)} – ${fmtDate(entry.periodEnd)}` : entry.id}
                      </p>
                      {entry.evidencePending && <EvidencePendingBadge />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted by {data.facility.company.owner.name} ({data.facility.company.owner.email}) · Last updated{" "}
                      {fmtDateTime(entry.updatedAt)}
                    </p>

                    <div className="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3 lg:grid-cols-4">
                      {ACTIVITY_DATA_FIELDS.filter((f) => entry[f.key] != null).map((f) => (
                        <Field key={f.key} label={f.label} value={formatFieldValue(f.key, entry[f.key])} />
                      ))}
                    </div>

                    {entry.financials && (
                      <div className="mt-5 border-t border-surface-border pt-4">
                        <h3 className="text-sm font-semibold text-foreground">Calculation engine output</h3>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-lg border border-surface-border p-4">
                            <p className="text-xs font-semibold text-teal-500">Specific Embedded Emissions (SEE)</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {fmtNum(entry.financials.actualSee, 3)} <span className="text-xs font-normal text-muted-foreground">{entry.financials.seeUnit}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">vs. EU default {fmtNum(entry.financials.defaultSee, 3)} {entry.financials.seeUnit}</p>
                            <MethodologyNote note={entry.financials.methodology.see} />
                          </div>

                          <div className="rounded-lg border border-surface-border p-4">
                            <p className="text-xs font-semibold text-teal-500">Estimated CBAM liability ({entry.financials.certificatePriceQuarter})</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">{fmtEur(entry.financials.grossLiabilityEur)}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtNum(entry.financials.certificatesRequired, 2)} certificates × {fmtEur(entry.financials.certificatePrice)}/tCO2e
                            </p>
                            <MethodologyNote note={entry.financials.methodology.cbamLiability} />
                          </div>

                          <div className="rounded-lg border border-surface-border p-4">
                            <p className="text-xs font-semibold text-blue-400">CCTS GHG Intensity</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {fmtNum(entry.financials.ghgIntensityCcts, 3)} <span className="text-xs font-normal text-muted-foreground">tCO2e/t</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.financials.cctsTargetIntensity != null
                                ? `vs. notified target ${fmtNum(entry.financials.cctsTargetIntensity, 3)} tCO2e/t (Δ ${fmtNum(entry.financials.cctsDeltaTco2e ?? 0, 2)} tCO2e)`
                                : "No BEE-notified target on file"}
                            </p>
                            <MethodologyNote note={entry.financials.methodology.cctsIntensity} />
                          </div>

                          <div className="rounded-lg border border-surface-border p-4">
                            <p className="text-xs font-semibold text-blue-400">Article 9 deduction</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {fmtNum(entry.financials.article9DeductionTonnes, 2)} <span className="text-xs font-normal text-muted-foreground">tCO2e</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{fmtEur(entry.financials.article9DeductionEur)} — net liability {fmtEur(entry.financials.netLiabilityEur)}</p>
                            <MethodologyNote note={entry.financials.methodology.article9} />
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            <h2 className="mt-8 text-lg font-semibold">Supporting documents</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {data.documents.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">File Name</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Period</th>
                      <th className="px-5 py-3 font-medium">Uploaded</th>
                      <th className="px-5 py-3 font-medium text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 text-foreground">{doc.fileName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{doc.documentType.replace(/_/g, " ")}</td>
                        <td className="px-5 py-3 text-muted-foreground">{doc.reportingPeriod}</td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDateTime(doc.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={downloadingId === doc.id}
                            onClick={() => handleDownload(doc.id, doc.fileName)}
                          >
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function VerifierFacilityDetailPage() {
  return (
    <VerifierRoute>
      <VerifierFacilityDetailContent />
    </VerifierRoute>
  );
}
