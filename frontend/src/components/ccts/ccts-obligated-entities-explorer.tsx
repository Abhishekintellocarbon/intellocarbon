"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { cctsObligatedEntitiesApi } from "@/lib/api";
import type { CctsObligatedEntity, CctsEntityStatus } from "@/lib/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function CctsObligatedEntitiesExplorer() {
  const [entities, setEntities] = useState<CctsObligatedEntity[] | null>(null);
  const [lastVerifiedDate, setLastVerifiedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [sector, setSector] = useState("");
  const [status, setStatus] = useState<CctsEntityStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    cctsObligatedEntitiesApi
      .list()
      .then(({ entities, lastVerifiedDate }) => {
        setEntities(entities);
        setLastVerifiedDate(lastVerifiedDate);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const states = useMemo(() => Array.from(new Set((entities ?? []).map((e) => e.state))).sort(), [entities]);
  const sectors = useMemo(() => Array.from(new Set((entities ?? []).map((e) => e.sector))).sort(), [entities]);

  const filtered = useMemo(() => {
    if (!entities) return [];
    let result = entities;
    if (state) result = result.filter((e) => e.state === state);
    if (sector) result = result.filter((e) => e.sector === sector);
    if (status) result = result.filter((e) => e.status === status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((e) => e.companyName.toLowerCase().includes(q) || e.district?.toLowerCase().includes(q));
    }
    return result;
  }, [entities, state, sector, status, search]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface px-5 py-3 text-sm text-muted-foreground">
        <span>
          Data last verified:{" "}
          <span className="font-medium text-foreground">
            {lastVerifiedDate ? fmtDate(lastVerifiedDate) : "Not yet published"}
          </span>
        </span>
      </div>

      <div className="mt-4">
        <Alert variant="info">
          Compiled from public BEE gazette notifications. Always confirm your specific obligation status directly
          with BEE. Intellocarbon is not responsible for errors or omissions in this reference list.
        </Alert>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        <Input
          placeholder="Search company or district…"
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as CctsEntityStatus | "")}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft (not yet final)</option>
          <option value="FINAL">Final</option>
        </Select>
      </div>

      {isLoading && (
        <div className="mt-10 flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      )}

      {!isLoading && entities && entities.length === 0 && (
        <Card className="mt-8 p-12 text-center">
          <p className="text-sm font-medium text-foreground">This list is being compiled.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re manually verifying obligated entities against BEE&apos;s published gazette notifications,
            sector by sector. Check back soon.
          </p>
        </Card>
      )}

      {!isLoading && entities && entities.length > 0 && filtered.length === 0 && (
        <Card className="mt-8 p-10 text-center text-sm text-muted-foreground">No entries match these filters.</Card>
      )}

      {!isLoading && filtered.length > 0 && (
        <Card className="mt-8 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Company / plant</th>
                <th className="px-5 py-3 font-medium">Sector</th>
                <th className="px-5 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Notification</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entity) => (
                <tr key={entity.id} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {entity.companyName}
                    {entity.district && (
                      <span className="block text-xs font-normal text-muted-foreground">{entity.district}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {entity.sector}
                    {entity.subSector ? ` (${entity.subSector})` : ""}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{entity.state}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        entity.status === "FINAL"
                          ? "rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500"
                          : "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500"
                      }
                    >
                      {entity.status === "FINAL" ? "Final" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {entity.notificationReference} · {fmtDate(entity.notificationDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="mt-10 flex flex-col items-center gap-4 border-teal-500/30 bg-teal-500/5 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-lg font-semibold text-foreground">Found your company on this list?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start your CCTS compliance with Intellocarbon — track GHG intensity, manage your certificate position,
            and generate BEE-format reports from one platform.
          </p>
        </div>
        <Link href="/signup" className="shrink-0">
          <Button size="sm" className="h-auto whitespace-nowrap rounded-[8px] px-5 py-2.5 font-semibold">
            Start your CCTS compliance
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </Card>
    </>
  );
}
