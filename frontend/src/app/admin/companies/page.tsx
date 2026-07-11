"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { adminApi } from "@/lib/api";
import type { AdminCompanySummary } from "@/lib/types";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const tierLabel = (tier: string) =>
  tier
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function AdminCompaniesContent() {
  const [companies, setCompanies] = useState<AdminCompanySummary[] | null>(null);

  useEffect(() => {
    adminApi.listCompanies().then(({ companies }) => setCompanies(companies));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-6 text-2xl font-semibold">Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every company registered on the platform.</p>

        <Card className="mt-6 overflow-x-auto p-0">
          {!companies ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
            </div>
          ) : companies.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No companies yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Company Name</th>
                  <th className="px-5 py-3 font-medium">CIN</th>
                  <th className="px-5 py-3 font-medium">GSTIN</th>
                  <th className="px-5 py-3 font-medium">Sector</th>
                  <th className="px-5 py-3 font-medium">Owner Email</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Facilities</th>
                  <th className="px-5 py-3 font-medium">Last Activity</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3">
                      <Link href={`/admin/companies/${c.id}`} className="font-medium text-foreground hover:text-teal-500">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.registrationNumber ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.gstin ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.sector}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.ownerEmail}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.plans.length > 0 ? c.plans.map(tierLabel).join(", ") : "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.facilityCount}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(c.lastActivity)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
  );
}

export default function AdminCompaniesPage() {
  return <AdminCompaniesContent />;
}
