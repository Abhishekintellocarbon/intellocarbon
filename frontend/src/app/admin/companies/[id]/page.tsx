"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { adminApi } from "@/lib/api";
import type { AdminCompanyDetail } from "@/lib/types";

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function AdminCompanyDetailContent() {
  const params = useParams<{ id: string }>();
  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getCompany(params.id)
      .then(({ company }) => setCompany(company))
      .catch(() => setError("Couldn't load this company."));
  }, [params.id]);

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
