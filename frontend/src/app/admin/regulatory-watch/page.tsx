"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { adminApi, ApiError } from "@/lib/api";
import type { RegulatoryWatchEntry } from "@/lib/types";

const REGIMES = [
  { value: "ICVCM", label: "ICVCM" },
  { value: "ARTICLE_6_PACM", label: "Article 6 / PACM" },
  { value: "DIGITAL_PRODUCT_PASSPORT", label: "Digital Product Passport" },
  { value: "TNFD", label: "TNFD" },
  { value: "OTHER", label: "Other" },
] as const;

const STATUSES = [
  { value: "MONITORING", label: "Monitoring" },
  { value: "DRAFT_PUBLISHED", label: "Draft published" },
  { value: "ADOPTED", label: "Adopted" },
  { value: "IN_FORCE", label: "In force" },
  { value: "SUPERSEDED", label: "Superseded" },
] as const;

const REGIME_LABELS = Object.fromEntries(REGIMES.map((r) => [r.value, r.label]));
const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

const textareaClass =
  "w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const emptyDraft = {
  regime: "ICVCM",
  title: "",
  summary: "",
  status: "MONITORING",
  sourceUrl: "",
  nextMilestone: "",
};

/**
 * Internal regulatory watch — regimes the platform does not implement yet but
 * expects to. Nothing here reaches a customer surface.
 *
 * The list is ordered least-recently-verified first and flags anything past
 * the staleness window. That ordering is the point of the page: a watch list
 * that looks tidy while nobody has checked it in a year is worse than no list,
 * because it reads as current. Saving an entry counts as verifying it, so
 * lastVerifiedAt moves on every edit.
 */
export default function RegulatoryWatchPage() {
  const [entries, setEntries] = useState<RegulatoryWatchEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({ ...emptyDraft });

  const load = () => {
    adminApi
      .listRegulatoryWatch()
      .then(({ entries }) => setEntries(entries))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the watch list."));
  };

  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const staleCount = entries?.filter((e) => e.stale).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Regulatory watch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Regimes we are following but have not built for — ICVCM, Article 6 / PACM, the EU Digital Product
            Passport, TNFD. Internal only; none of this reaches a customer surface.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" isLoading={busy} onClick={() => run(() => adminApi.seedRegulatoryWatch())}>
            <RefreshCw className="h-3.5 w-3.5" />
            Load starting entries
          </Button>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add entry
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {staleCount > 0 && (
        <div className="mt-4">
          <Alert variant="info">
            {staleCount} {staleCount === 1 ? "entry has" : "entries have"} not been verified in over 90 days. Open the
            source, confirm the position, and save — saving records the check.
          </Alert>
        </div>
      )}

      {showForm && (
        <Card className="mt-6 p-6">
          <h2 className="font-medium">New entry</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="regime">Regime</Label>
              <Select id="regime" value={draft.regime} onChange={(e) => setDraft({ ...draft, regime: e.target.value })}>
                {REGIMES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="summary">Summary</Label>
              <textarea
                id="summary"
                rows={3}
                className={textareaClass}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input
                id="sourceUrl"
                placeholder="https://"
                value={draft.sourceUrl}
                onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="nextMilestone">Next milestone</Label>
              <Input
                id="nextMilestone"
                placeholder="expected H2 2026"
                value={draft.nextMilestone}
                onChange={(e) => setDraft({ ...draft, nextMilestone: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={busy}
              onClick={() =>
                run(async () => {
                  await adminApi.createRegulatoryWatch(draft);
                  setDraft({ ...emptyDraft });
                  setShowForm(false);
                })
              }
            >
              Save entry
            </Button>
          </div>
        </Card>
      )}

      {entries === null && !error ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      ) : entries && entries.length === 0 ? (
        <Card className="mt-6 p-12 text-center">
          <h3 className="font-medium">Nothing on the watch list</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Load the starting entries for ICVCM, Article 6 / PACM, the Digital Product Passport and TNFD, then verify
            each against its source.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          {entries?.map((entry) => (
            <Card key={entry.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {REGIME_LABELS[entry.regime] ?? entry.regime}
                    </span>
                    <span className="text-[11px] font-semibold text-teal-500">
                      {STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    {entry.stale && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Needs checking
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{entry.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{entry.summary}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Last verified {fmtDate(entry.lastVerifiedAt)}</span>
                    {entry.nextMilestone && <span>Next: {entry.nextMilestone}</span>}
                    {entry.sourceUrl && (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-teal-500 hover:underline"
                      >
                        Source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => adminApi.deleteRegulatoryWatch(entry.id))}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
