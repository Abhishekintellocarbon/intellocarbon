"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Loader2, Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ghgRunnerApi } from "@/lib/api";
import type { GhgEngagementSummary } from "@/lib/types";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtTco2e = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} tCO2e`);

const JURISDICTION_LABEL: Record<string, string> = {
  US_CALIFORNIA: "US — California",
  UK: "United Kingdom",
  AUSTRALIA: "Australia",
  UAE_MIDDLE_EAST: "UAE / Middle East",
  EU: "European Union",
  OTHER_GHG_PROTOCOL: "Other (GHG Protocol)",
};

function GhgRunnerContent() {
  const router = useRouter();
  const [engagements, setEngagements] = useState<GhgEngagementSummary[] | null>(null);
  const [search, setSearch] = useState("");

  const load = (q?: string) => {
    ghgRunnerApi.list(q).then(({ engagements }) => setEngagements(engagements));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <AdminTabs />

        <h1 className="mt-6 text-2xl font-semibold">GHG Runner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual GHG Protocol calculations and white-label report generation for foreign consulting engagements. No
          client login involved.
        </p>

        <Card className="mt-6 flex items-start gap-3 p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
          <div>
            <p className="text-sm font-medium text-foreground">Pricing reference (internal only)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              US (SB 253): $3,500 · UK/Australia/EU/Japan: $3,000 · UAE/Gulf/Other: $2,500 — volume: 5+ reports −20%,
              10+ reports −30% (approx). Floor: $1,500. Complex engagements (multi-country, 20+ sites): custom
              $5,000–8,000.
            </p>
            <p className="mt-1 text-xs text-muted">Display only — not connected to any billing logic.</p>
          </div>
        </Card>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search by organization name…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72"
          />
          <Link href="/admin/ghg-runner/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Engagement
            </Button>
          </Link>
        </div>

        {engagements === null && (
          <div className="mt-8 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {engagements && engagements.length === 0 && (
          <Card className="mt-4 p-10 text-center text-sm text-muted-foreground">
            {search ? "No engagements match your search." : "No engagements yet — create one to get started."}
          </Card>
        )}

        {engagements && engagements.length > 0 && (
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Jurisdiction</th>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-surface-border last:border-0 hover:bg-surface-raised"
                    onClick={() => router.push(`/admin/ghg-runner/${e.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{e.organizationName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">{JURISDICTION_LABEL[e.jurisdiction] ?? e.jurisdiction}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDate(e.reportingPeriodStart)} – {fmtDate(e.reportingPeriodEnd)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{fmtTco2e(e.totalTco2e)}</td>
                    <td className="px-4 py-3">
                      {e.status === "FINALIZED" ? (
                        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                          Finalized
                        </span>
                      ) : (
                        <span className="rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(e.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function GhgRunnerPage() {
  return (
    <SuperAdminRoute>
      <GhgRunnerContent />
    </SuperAdminRoute>
  );
}
