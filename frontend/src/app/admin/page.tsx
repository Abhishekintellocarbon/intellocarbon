"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, FileText, Loader2, Users, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/api";
import type { AdminOverview } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const tierLabel = (tier: string) =>
  tier
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const STATUS_STYLES: Record<string, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  APPROVED: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  REJECTED: "border-danger/30 bg-danger/10 text-danger",
};

function MetricCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
          <Icon className="h-4 w-4 text-teal-500" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value.toLocaleString("en-IN")}</p>
    </Card>
  );
}

function AdminOverviewContent() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    adminApi
      .overview()
      .then(setOverview)
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const decide = async (userId: string, action: "approve" | "reject") => {
    setActioningId(userId);
    try {
      await (action === "approve" ? adminApi.approveUser(userId) : adminApi.rejectUser(userId));
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              recentSignups: prev.recentSignups.map((s) =>
                s.id === userId ? { ...s, approvalStatus: action === "approve" ? "APPROVED" : "REJECTED" } : s,
              ),
            }
          : prev,
      );
    } finally {
      setActioningId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide activity across every company.</p>

        {isLoading && !overview ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : overview ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total Companies" value={overview.metrics.totalCompanies} icon={Building2} />
              <MetricCard label="Total Users" value={overview.metrics.totalUsers} icon={Users} />
              <MetricCard label="Total Reports Generated" value={overview.metrics.totalReports} icon={FileText} />
              <MetricCard label="Total Lead Captures" value={overview.metrics.totalLeadCaptures} icon={FileText} />
            </div>

            {/* Recent Signups */}
            <h2 className="mt-10 text-lg font-semibold">Recent Signups</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {overview.recentSignups.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No signups yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Company</th>
                      <th className="px-5 py-3 font-medium">Sector</th>
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Approval Status</th>
                      <th className="px-5 py-3 font-medium">Signed Up</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentSignups.map((s) => (
                      <tr key={s.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.email}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.companyName ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.sector ?? "—"}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {s.plans.length > 0 ? s.plans.map(tierLabel).join(", ") : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.approvalStatus]}`}>
                            {s.approvalStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.createdAt)}</td>
                        <td className="px-5 py-3">
                          {s.approvalStatus === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" isLoading={actioningId === s.id} onClick={() => decide(s.id, "approve")}>
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                isLoading={actioningId === s.id}
                                onClick={() => decide(s.id, "reject")}
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Recent Activity */}
            <h2 className="mt-10 text-lg font-semibold">Recent Activity</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {overview.recentActivity.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">User Email</th>
                      <th className="px-5 py-3 font-medium">Action Type</th>
                      <th className="px-5 py-3 font-medium">Description</th>
                      <th className="px-5 py-3 font-medium">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentActivity.map((a) => (
                      <tr key={a.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 text-muted-foreground">{a.userEmail ?? "—"}</td>
                        <td className="px-5 py-3">
                          <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                            {a.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-foreground/90">{a.detail}</td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Lead Captures */}
            <div className="mt-10 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Lead Captures</h2>
              <Link href="/admin/leads" className="text-sm text-teal-500 hover:text-teal-400">
                View all leads
              </Link>
            </div>
            <Card className="mt-4 overflow-x-auto p-0">
              {overview.recentLeads.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No leads captured yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Tool Used</th>
                      <th className="px-5 py-3 font-medium">Sector</th>
                      <th className="px-5 py-3 font-medium">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentLeads.map((lead) => {
                      const inputs = lead.inputsJson as { sector?: string } | null;
                      return (
                        <tr key={lead.id} className="border-b border-surface-border last:border-b-0">
                          <td className="px-5 py-3 text-muted-foreground">{lead.email}</td>
                          <td className="px-5 py-3">
                            <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                              {lead.toolUsed}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{inputs?.sector ?? "—"}</td>
                          <td className="px-5 py-3 text-muted-foreground">{fmtDate(lead.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        ) : null}
    </main>
  );
}

export default function AdminOverviewPage() {
  return <AdminOverviewContent />;
}
