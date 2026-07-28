"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminApi } from "@/lib/api";
import type { FacilityShortfallRow } from "@/lib/types";

const fmtInr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const tierLabel = (tier: string) =>
  tier
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function AdminFacilityReconciliationContent() {
  const [rows, setRows] = useState<FacilityShortfallRow[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .facilityReconciliation()
      .then((data) => {
        setRows(data.rows);
        setGeneratedAt(data.generatedAt);
      })
      .catch(() => setError("Couldn't load the facility reconciliation report."))
      .finally(() => setIsLoading(false));
  }, []);

  const totalGapInr = rows?.reduce((sum, r) => sum + r.estimatedMonthlyGapInr, 0) ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mt-6 text-2xl font-semibold">Facility Reconciliation</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Companies whose current facility count exceeds what their active subscription(s) cover
        (<code className="text-xs">facilitiesIncluded</code>). This is visibility only — nothing here auto-charges
        anyone. Review each row and follow up manually (upgrade the customer, or adjust their subscription&apos;s
        covered facility count).
      </p>

      {isLoading && !rows ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-danger">{error}</p>
      ) : rows ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs text-muted-foreground">Companies under-covered</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{rows.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-muted-foreground">Estimated monthly gap (upper bound)</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{fmtInr(totalGapInr)}</p>
            </Card>
          </div>

          {generatedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Generated {new Date(generatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          <Card className="mt-4 overflow-x-auto p-0">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
                  <AlertTriangle className="h-4 w-4 text-teal-500" />
                </span>
                <p className="text-sm text-muted-foreground">
                  No companies are currently under-covered — every active subscription covers at least as many
                  facilities as the company has.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-5 py-3 font-medium">Owner Email</th>
                    <th className="px-5 py-3 font-medium">Active Plan(s)</th>
                    <th className="px-5 py-3 font-medium">Facilities</th>
                    <th className="px-5 py-3 font-medium">Covered</th>
                    <th className="px-5 py-3 font-medium">Shortfall</th>
                    <th className="px-5 py-3 font-medium">Est. Monthly Gap</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.companyId} className="border-b border-surface-border last:border-b-0">
                      <td className="px-5 py-3 font-medium text-foreground">{r.companyName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.ownerEmail}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {r.tiers.length === 0 ? "—" : r.tiers.map(tierLabel).join(", ")}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{r.facilityCount}</td>
                      <td className="px-5 py-3 text-muted-foreground">{r.facilitiesCovered}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-2 py-0.5 text-xs font-medium text-[#FF6B6B]">
                          {r.shortfall}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{fmtInr(r.estimatedMonthlyGapInr)}</td>
                      <td className="px-5 py-3">
                        <Link href={`/admin/companies/${r.companyId}`} className="font-medium text-teal-500 hover:underline">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </main>
  );
}

export default function AdminFacilityReconciliationPage() {
  return <AdminFacilityReconciliationContent />;
}
