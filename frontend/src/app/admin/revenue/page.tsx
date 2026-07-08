"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Building2, IndianRupee, Loader2, TrendingUp, XCircle } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { adminApi } from "@/lib/api";
import type { AdminRevenue, AdminRevenueSubscriptionRow } from "@/lib/types";

// Matches the design system's chart red (#FF6B6B), distinct from the
// slightly different "danger" tailwind token used for form validation.
const CANCEL_RED = "#FF6B6B";

const fmtInr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const tierLabel = (tier: string) =>
  tier
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

function MetricCard({
  label,
  value,
  icon: Icon,
  accent = "teal",
}: {
  label: string;
  value: string;
  icon: typeof Building2;
  accent?: "teal" | "red";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
          <Icon className="h-4 w-4" style={{ color: accent === "red" ? CANCEL_RED : "#00D4AA" }} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </Card>
  );
}

function PlanDistribution({ planDistribution }: { planDistribution: AdminRevenue["planDistribution"] }) {
  const maxMrr = Math.max(1, ...planDistribution.map((p) => p.mrrInr));

  return (
    <Card className="mt-4 p-5">
      {planDistribution.every((p) => p.subscriberCount === 0) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No active subscriptions yet.</p>
      ) : (
        <div className="space-y-4">
          {planDistribution.map((p) => (
            <div key={p.tier}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{p.planName}</span>
                <span className="text-muted-foreground">
                  {p.subscriberCount} subscriber{p.subscriberCount === 1 ? "" : "s"} · {fmtInr(p.mrrInr)} MRR
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-teal-500"
                  style={{ width: `${(p.mrrInr / maxMrr) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-teal-500/30 bg-teal-500/10 text-teal-500",
  CANCELED: "border-[#FF6B6B]/30 bg-[#FF6B6B]/10 text-[#FF6B6B]",
};

function SubscriptionsTable({ subscriptions }: { subscriptions: AdminRevenueSubscriptionRow[] }) {
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let result = subscriptions;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((s) => s.companyName.toLowerCase().includes(q) || s.ownerEmail.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      const diff = new Date(a.subscribedAt).getTime() - new Date(b.subscribedAt).getTime();
      return sortDir === "desc" ? -diff : diff;
    });
  }, [subscriptions, search, sortDir]);

  return (
    <>
      <Card className="mt-4 p-5">
        <Label htmlFor="revenue-search">Search</Label>
        <Input
          id="revenue-search"
          placeholder="Company name or owner email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </Card>

      <Card className="mt-4 overflow-x-auto p-0">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No subscriptions match this search.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Company Name</th>
                <th className="px-5 py-3 font-medium">Owner Email</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Facilities</th>
                <th className="px-5 py-3 font-medium">Monthly Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  >
                    Subscribed On
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-5 py-3 font-medium">Cancelled On</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-3 font-medium text-foreground">{s.companyName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.ownerEmail}</td>
                  <td className="px-5 py-3 text-muted-foreground">{tierLabel(s.tier)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.facilityCount}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtInr(s.monthlyPriceInr)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? ""}`}>
                      {s.status === "CANCELED" ? "CANCELLED" : s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(s.subscribedAt)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{s.cancelledAt ? fmtDate(s.cancelledAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function RevenueTrendChart({ trend, trendHasFullHistory }: { trend: AdminRevenue["trend"]; trendHasFullHistory: boolean }) {
  return (
    <Card className="mt-4 p-6">
      {!trendHasFullHistory && (
        <p className="mb-4 text-xs text-muted-foreground">Limited history — trend will build over time.</p>
      )}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#22303f" vertical={false} />
            <XAxis dataKey="monthLabel" stroke="#8AA0B4" fontSize={12} />
            <YAxis stroke="#8AA0B4" fontSize={12} tickFormatter={(v: number) => fmtInr(v)} width={90} />
            <Tooltip
              formatter={(value) => fmtInr(Number(value))}
              contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="mrrInr" name="MRR" stroke="#00D4AA" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AdminRevenueContent() {
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .revenue()
      .then(setRevenue)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <AdminTabs />

        <h1 className="mt-6 text-2xl font-semibold">Revenue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live subscription revenue across every company on the platform.</p>

        {isLoading && !revenue ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        ) : revenue ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Total MRR" value={fmtInr(revenue.metrics.totalMrrInr)} icon={IndianRupee} />
              <MetricCard label="Total Companies Paying" value={revenue.metrics.totalCompaniesPaying.toLocaleString("en-IN")} icon={Building2} />
              <MetricCard label="Projected ARR" value={fmtInr(revenue.metrics.projectedArrInr)} icon={TrendingUp} />
              <MetricCard
                label="Cancelled This Month"
                value={revenue.metrics.cancelledThisMonth.toLocaleString("en-IN")}
                icon={XCircle}
                accent="red"
              />
            </div>

            <h2 className="mt-10 text-lg font-semibold">Plan Distribution</h2>
            <PlanDistribution planDistribution={revenue.planDistribution} />

            <h2 className="mt-10 text-lg font-semibold">Revenue Trend</h2>
            <RevenueTrendChart trend={revenue.trend} trendHasFullHistory={revenue.trendHasFullHistory} />

            <h2 className="mt-10 text-lg font-semibold">All Subscriptions</h2>
            <SubscriptionsTable subscriptions={revenue.subscriptions} />
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function AdminRevenuePage() {
  return (
    <SuperAdminRoute>
      <AdminRevenueContent />
    </SuperAdminRoute>
  );
}
