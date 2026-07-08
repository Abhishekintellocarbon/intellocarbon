"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Calendar, ClipboardCheck, Factory, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { VerifierRoute } from "@/components/auth/verifier-route";
import { AppHeader } from "@/components/layout/app-header";
import { verifierApi, ApiError } from "@/lib/api";
import type { VerificationRequestDetail, VerifierAssignedCompany } from "@/lib/types";
import { useAuth } from "@/context/auth-context";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-surface-raised text-muted-foreground border-surface-border",
  IN_REVIEW: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  APPROVED: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  REJECTED: "bg-danger/10 text-danger border-danger/30",
};

function RequestCard({
  request,
  action,
}: {
  request: VerificationRequestDetail;
  action?: React.ReactNode;
}) {
  const { activityData } = request;
  const { facility } = activityData;

  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[request.status]}`}>
            {request.status.replace(/_/g, " ")}
          </span>
          {activityData.evidencePending && <EvidencePendingBadge />}
          <span className="text-sm font-medium">{facility.company.name}</span>
        </div>
        <p className="mt-1.5 text-sm text-foreground/90">
          {facility.name} — {activityData.productCategory}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(activityData.periodStart)} – {formatDate(activityData.periodEnd)} · submitted{" "}
          {formatDate(request.submittedAt)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {activityData.calculationResult && (
          <div className="text-right text-xs text-muted-foreground">
            <p>SEE: {activityData.calculationResult.specificEmbeddedEmissionsCbam.toFixed(3)} tCO2e/t</p>
            <p>GHG: {activityData.calculationResult.ghgIntensityCcts.toFixed(3)} tCO2e/t</p>
          </div>
        )}
        {action}
      </div>
    </Card>
  );
}

function VerifierDashboardContent() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<VerifierAssignedCompany[] | null>(null);
  const [pending, setPending] = useState<VerificationRequestDetail[] | null>(null);
  const [mine, setMine] = useState<VerificationRequestDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const refresh = () => {
    verifierApi.listCompanies().then(({ companies }) => setCompanies(companies));
    verifierApi.listPending().then(({ requests }) => setPending(requests));
    verifierApi.listMine().then(({ requests }) => setMine(requests));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleClaim = async (id: string) => {
    setClaimingId(id);
    setError(null);
    try {
      await verifierApi.claim(id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't claim this request.");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Verifier dashboard</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}. Review submitted emissions data and
          issue verification decisions.
        </p>

        {error && (
          <div className="mt-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <h2 className="mt-8 mb-3 text-lg font-semibold">Assigned companies</h2>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">Companies assigned to you, and their facilities with at least one submission to review.</p>
        {companies === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}
        {companies && companies.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Building2 className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-muted-foreground">No companies have been assigned to you yet.</p>
          </Card>
        )}
        {companies && companies.length > 0 && (
          <div className="space-y-6">
            {companies.map((c) => (
              <Card key={c.id} className="p-5">
                <Link href={`/verifier/companies/${c.id}`} className="flex items-center gap-2 hover:text-teal-500">
                  <Building2 className="h-4 w-4" />
                  <h3 className="font-medium text-foreground">{c.name}</h3>
                </Link>
                {c.facilities.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No facilities have submitted anything for this company yet.</p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {c.facilities.map((f) => (
                      <Link key={f.id} href={`/verifier/facilities/${f.id}`}>
                        <Card className="h-full p-4 transition-colors hover:border-teal-500/40">
                          <div className="flex items-start justify-between">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                              <Factory className="h-3.5 w-3.5 text-teal-500" />
                            </span>
                            {f.evidencePending && <EvidencePendingBadge />}
                          </div>
                          <h4 className="mt-2.5 text-sm font-medium text-foreground">{f.name}</h4>
                          <p className="mt-1.5 text-xs text-muted">
                            {f.submittedEntryCount} submitted {f.submittedEntryCount === 1 ? "entry" : "entries"}
                          </p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <h2 className="mt-10 mb-3 text-lg font-semibold">Pending requests</h2>
        {pending === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}
        {pending && pending.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <ClipboardCheck className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-muted-foreground">No pending verification requests right now.</p>
          </Card>
        )}
        {pending && pending.length > 0 && (
          <div className="space-y-3">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                action={
                  <Button size="sm" onClick={() => handleClaim(r.id)} isLoading={claimingId === r.id}>
                    Claim
                  </Button>
                }
              />
            ))}
          </div>
        )}

        <h2 className="mt-10 mb-3 text-lg font-semibold">My assignments</h2>
        {mine === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}
        {mine && mine.length === 0 && (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t claimed any requests yet.</p>
          </Card>
        )}
        {mine && mine.length > 0 && (
          <div className="space-y-3">
            {mine.map((r) => (
              <Link key={r.id} href={`/verifier/review/${r.id}`}>
                <RequestCard request={r} action={<Button variant="secondary" size="sm">Review</Button>} />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function VerifierDashboardPage() {
  return (
    <VerifierRoute>
      <VerifierDashboardContent />
    </VerifierRoute>
  );
}
