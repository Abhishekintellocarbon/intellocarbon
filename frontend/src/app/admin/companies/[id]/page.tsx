"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { adminApi, ApiError } from "@/lib/api";
import type { AdminCompanyDetail, AdminVerifierSummary } from "@/lib/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const tierLabel = (tier: string) =>
  tier
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function AdminCompanyDetailContent() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [verifiers, setVerifiers] = useState<AdminVerifierSummary[] | null>(null);
  const [selectedVerifierId, setSelectedVerifierId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getCompany(params.id)
      .then(({ company }) => setCompany(company))
      .catch(() => setError("Couldn't load this company."));
    adminApi.listVerifiers().then(({ verifiers }) => setVerifiers(verifiers));
  }, [params.id]);

  const assignedVerifierIds = new Set(company?.verifierAssignments.map((a) => a.verifier.id) ?? []);
  const availableVerifiers = (verifiers ?? []).filter((v) => !assignedVerifierIds.has(v.id));

  const handleAssign = async () => {
    if (!selectedVerifierId) return;
    setAssignError(null);
    setIsAssigning(true);
    try {
      const { assignment } = await adminApi.assignVerifier(params.id, selectedVerifierId);
      setCompany((prev) => (prev ? { ...prev, verifierAssignments: [...prev.verifierAssignments, assignment] } : prev));
      setSelectedVerifierId("");
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Couldn't assign this verifier.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (verifierId: string) => {
    setRemovingId(verifierId);
    try {
      await adminApi.unassignVerifier(params.id, verifierId);
      setCompany((prev) =>
        prev ? { ...prev, verifierAssignments: prev.verifierAssignments.filter((a) => a.verifier.id !== verifierId) } : prev,
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/admin/companies" className="text-sm text-teal-500 hover:text-teal-400">
          Back to companies
        </Link>

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {!company && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {company && (
          <>
            <h1 className="mt-4 text-2xl font-semibold">{company.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Owner: {company.owner.email}</p>

            <Card className="mt-6 grid gap-5 p-6 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Company ID" value={company.id} />
              <Field label="GSTIN / Registration No." value={company.registrationNumber} />
              <Field label="Sector" value={company.sector} />
              <Field label="Sub-sector" value={company.subSector} />
              <Field label="Address" value={company.address} />
              <Field label="City" value={company.city} />
              <Field label="State" value={company.state} />
              <Field label="Pincode" value={company.pincode} />
              <Field label="Country" value={company.country} />
              <Field label="Annual Turnover (INR)" value={company.annualTurnoverInr?.toLocaleString("en-IN")} />
              <Field label="Employee Count" value={company.employeeCount} />
              <Field label="Reporting FY Start Month" value={company.reportingFyStartMonth} />
              <Field label="Applies CBAM" value={company.appliesCbam ? "Yes" : "No"} />
              <Field label="Applies CCTS" value={company.appliesCcts ? "Yes" : "No"} />
              <Field label="PAT Designated Consumer" value={company.isPatDesignatedConsumer ? "Yes" : "No"} />
              <Field label="Onboarding Completed" value={fmtDate(company.onboardingCompletedAt)} />
              <Field label="EU Importer Name" value={company.euImporterName} />
              <Field label="EU Importer EORI" value={company.euImporterEori} />
              <Field label="EU Importer Country" value={company.euImporterCountry} />
              <Field label="EU Importer Contact Email" value={company.euImporterContactEmail} />
              <Field label="EU Importer Contact Phone" value={company.euImporterContactPhone} />
              <Field label="Created" value={fmtDate(company.createdAt)} />
              <Field label="Last Updated" value={fmtDate(company.updatedAt)} />
            </Card>

            <h2 className="mt-8 text-lg font-semibold">Owner</h2>
            <Card className="mt-4 grid gap-5 p-6 sm:grid-cols-3">
              <Field label="Name" value={company.owner.name} />
              <Field label="Email" value={company.owner.email} />
              <Field label="Approval Status" value={company.owner.approvalStatus} />
              <Field label="Signed Up" value={fmtDate(company.owner.createdAt)} />
            </Card>

            <h2 className="mt-8 text-lg font-semibold">Assigned verifiers</h2>
            <Card className="mt-4 p-6">
              {company.verifierAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No verifiers assigned yet. This company&apos;s submissions won&apos;t appear in any verifier&apos;s portal until one is assigned.</p>
              ) : (
                <ul className="space-y-2">
                  {company.verifierAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-surface-border p-3 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{a.verifier.name}</p>
                        <p className="text-xs text-muted-foreground">{a.verifier.email} · Assigned {fmtDate(a.assignedAt)}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={removingId === a.verifier.id}
                        onClick={() => handleUnassign(a.verifier.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {assignError && <p className="mt-3 text-xs text-danger">{assignError}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-border pt-4">
                <select
                  value={selectedVerifierId}
                  onChange={(e) => setSelectedVerifierId(e.target.value)}
                  className="rounded-xl border border-surface-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-500/60"
                >
                  <option value="">Select a verifier…</option>
                  {availableVerifiers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.email})
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleAssign} isLoading={isAssigning} disabled={!selectedVerifierId}>
                  Assign verifier
                </Button>
                {verifiers && verifiers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No users with the Verifier role exist yet.</p>
                )}
              </div>
            </Card>

            <h2 className="mt-8 text-lg font-semibold">Subscriptions</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {company.subscriptions.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No subscriptions yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Tier</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Current Period End</th>
                      <th className="px-5 py-3 font-medium">Cancels at Period End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.subscriptions.map((s) => (
                      <tr key={s.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 text-foreground">{tierLabel(s.tier)}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.status}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd) : "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.cancelAtPeriodEnd ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <h2 className="mt-8 text-lg font-semibold">Facilities</h2>
            {company.facilities.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">No facilities yet.</Card>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {company.facilities.map((f) => (
                  <Link key={f.id} href={`/admin/facilities/${f.id}`}>
                    <Card className="h-full p-5 transition-colors hover:border-teal-500/40">
                      <div className="flex items-start justify-between">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                          <Factory className="h-4 w-4 text-teal-500" />
                        </span>
                        {f.isDraft && (
                          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 font-medium text-foreground">{f.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{f._count.activityData} activity data entries</p>
                      <p className="mt-2 text-xs text-muted">Updated {fmtDateTime(f.updatedAt)}</p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminCompanyDetailPage() {
  return (
    <SuperAdminRoute>
      <AdminCompanyDetailContent />
    </SuperAdminRoute>
  );
}
