"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { adminApi } from "@/lib/api";
import type { LeadCapture } from "@/lib/intellocalc-types";

const TOOL_OPTIONS = [
  { value: "", label: "All tools" },
  { value: "BORDER", label: "IntelloCalc Border" },
  { value: "INDIA", label: "IntelloCalc India" },
  { value: "COMPLY", label: "IntelloCalc Comply" },
  { value: "ESG_GRI", label: "ESG waitlist — GRI" },
  { value: "ESG_ISSB", label: "ESG waitlist — ISSB" },
  { value: "ESG_CSRD", label: "ESG waitlist — CSRD" },
  { value: "ESG_CDP", label: "ESG waitlist — CDP" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const sectorOf = (lead: LeadCapture): string => {
  const inputs = lead.inputsJson as { sector?: string } | null;
  return inputs?.sector ?? "—";
};

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

function AdminLeadsContent() {
  const [leads, setLeads] = useState<LeadCapture[] | null>(null);
  const [tool, setTool] = useState("");
  const [sector, setSector] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    adminApi
      .listLeads({ tool: tool || undefined, from: from || undefined, to: to || undefined })
      .then(({ leads }) => setLeads(leads))
      .finally(() => setIsLoading(false));
  }, [tool, from, to]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    let result = leads;
    if (sector.trim()) {
      result = result.filter((l) => sectorOf(l).toLowerCase().includes(sector.trim().toLowerCase()));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) => l.email.toLowerCase().includes(q) || (l.name ?? "").toLowerCase().includes(q) || (l.company ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [leads, sector, search]);

  const exportToCsv = () => {
    const headers = ["Name", "Company", "Email", "Tool", "Sector", "Submitted"];
    const rows = filteredLeads.map((l) => [l.name ?? "", l.company ?? "", l.email, l.toolUsed, sectorOf(l), l.createdAt]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <AdminTabs />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              All leads captured across IntelloCalc Border, India, and Comply.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={exportToCsv} disabled={filteredLeads.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export to CSV
          </Button>
        </div>

        <Card className="mt-6 grid gap-4 p-5 sm:grid-cols-5">
          <div>
            <Label htmlFor="search">Search</Label>
            <Input id="search" placeholder="Name, email, or company" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tool">Tool</Label>
            <Select id="tool" value={tool} onChange={(e) => setTool(e.target.value)}>
              {TOOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sector">Sector contains</Label>
            <Input id="sector" placeholder="e.g. CEMENT" value={sector} onChange={(e) => setSector(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="from">From date</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">To date</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </Card>

        <Card className="mt-6 overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No leads match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Tool</th>
                  <th className="px-5 py-3 font-medium">Sector</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3 font-medium text-foreground">{lead.name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lead.company ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{lead.email}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                        {lead.toolUsed}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{sectorOf(lead)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(lead.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </div>
  );
}

export default function AdminLeadsPage() {
  return (
    <SuperAdminRoute>
      <AdminLeadsContent />
    </SuperAdminRoute>
  );
}
