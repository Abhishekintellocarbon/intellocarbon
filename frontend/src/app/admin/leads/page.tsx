"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
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

function AdminLeadsContent() {
  const [leads, setLeads] = useState<LeadCapture[] | null>(null);
  const [tool, setTool] = useState("");
  const [sector, setSector] = useState("");
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
    if (!sector.trim()) return leads;
    return leads.filter((l) => sectorOf(l).toLowerCase().includes(sector.trim().toLowerCase()));
  }, [leads, sector]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">IntelloCalc Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All leads captured across IntelloCalc Border, India, and Comply.
        </p>

        <Card className="mt-6 grid gap-4 p-5 sm:grid-cols-4">
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
