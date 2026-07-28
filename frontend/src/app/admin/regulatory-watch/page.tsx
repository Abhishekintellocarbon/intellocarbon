"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, Search, Upload, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { adminApi, ApiError } from "@/lib/api";
import type {
  CctsObligatedEntity,
  CctsEntityStatus,
  CreateCctsObligatedEntityInput,
  CctsBulkImportRowResult,
} from "@/lib/types";

const STATUS_OPTIONS: { value: CctsEntityStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft (open for comment, not yet final)" },
  { value: "FINAL", label: "Final (gazetted, binding)" },
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const toDateInput = (iso: string) => iso.slice(0, 10);

// -----------------------------------------------------------------------
// CSV parsing — a small quote-aware parser (no library dependency). The
// admin uploads a file they've built themselves from a verified gazette
// list, so this stays forgiving about column order but strict about the
// required header names.
// -----------------------------------------------------------------------

const CSV_COLUMNS = [
  "companyName",
  "sector",
  "subSector",
  "state",
  "district",
  "notificationReference",
  "notificationDate",
  "status",
  "baselineIntensity",
  "targetIntensity",
  "sourceUrl",
  "lastVerifiedDate",
] as const;

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
};

interface CsvParseResult {
  rows: CreateCctsObligatedEntityInput[];
  errors: string[];
}

const parseCsvText = (text: string): CsvParseResult => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], errors: ["File is empty."] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const missing = ["companyName", "sector", "state", "notificationReference", "notificationDate", "lastVerifiedDate"].filter(
    (required) => !header.includes(required),
  );
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }

  const rows: CreateCctsObligatedEntityInput[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    header.forEach((col, idx) => {
      record[col] = cells[idx] ?? "";
    });

    if (!record.companyName) {
      errors.push(`Row ${i + 1}: missing companyName, skipped.`);
      continue;
    }

    const status: CctsEntityStatus = record.status?.toUpperCase() === "FINAL" ? "FINAL" : "DRAFT";

    rows.push({
      companyName: record.companyName,
      sector: record.sector,
      subSector: record.subSector || undefined,
      state: record.state,
      district: record.district || undefined,
      notificationReference: record.notificationReference,
      notificationDate: record.notificationDate,
      status,
      baselineIntensity: record.baselineIntensity ? Number(record.baselineIntensity) : undefined,
      targetIntensity: record.targetIntensity ? Number(record.targetIntensity) : undefined,
      sourceUrl: record.sourceUrl || undefined,
      lastVerifiedDate: record.lastVerifiedDate,
    });
  }

  return { rows, errors };
};

const downloadSampleCsv = () => {
  const header = CSV_COLUMNS.join(",");
  const sampleRows = [
    [
      "Test Steel Works Pvt Ltd",
      "Iron & Steel",
      "EAF",
      "Odisha",
      "Sundargarh",
      "G.S.R. 234(E)",
      "2025-04-01",
      "DRAFT",
      "2.15",
      "1.95",
      "https://example.gov.in/gazette/test",
      new Date().toISOString().slice(0, 10),
    ],
    [
      "Sample Cement Co Ltd",
      "Cement",
      "",
      "Rajasthan",
      "Chittorgarh",
      "G.S.R. 234(E)",
      "2025-04-01",
      "FINAL",
      "",
      "",
      "https://example.gov.in/gazette/test",
      new Date().toISOString().slice(0, 10),
    ],
    [
      "Fake Fertilizer Industries",
      "Fertilizer",
      "",
      "Gujarat",
      "",
      "G.S.R. 234(E)",
      "2025-04-01",
      "FINAL",
      "",
      "",
      "",
      new Date().toISOString().slice(0, 10),
    ],
  ];
  const csv = [header, ...sampleRows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ccts-obligated-entities-sample.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// -----------------------------------------------------------------------
// CSV bulk import panel
// -----------------------------------------------------------------------

function BulkImportPanel({ onImported }: { onImported: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [pendingRows, setPendingRows] = useState<CreateCctsObligatedEntityInput[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<CctsBulkImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResults(null);
    setError(null);
    const text = await file.text();
    const { rows, errors } = parseCsvText(text);
    setPendingRows(rows);
    setParseErrors(errors);
  };

  const handleImport = async () => {
    if (pendingRows.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const { results } = await adminApi.bulkImportCctsObligatedEntities(pendingRows);
      setResults(results);
      if (results.some((r) => r.success)) onImported();
      setPendingRows([]);
      setFileName(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't import this file.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">CSV bulk import</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Columns: {CSV_COLUMNS.join(", ")}. Required: companyName, sector, state, notificationReference,
            notificationDate, lastVerifiedDate. Dates as YYYY-MM-DD.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={downloadSampleCsv}>
          <Download className="h-3.5 w-3.5" />
          Download sample (test) CSV
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-raised">
          <Upload className="h-4 w-4" />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
        {pendingRows.length > 0 && (
          <Button size="sm" onClick={handleImport} isLoading={isImporting}>
            Import {pendingRows.length} row{pendingRows.length === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      {parseErrors.length > 0 && (
        <div className="mt-4">
          <Alert variant="error">
            {parseErrors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {results && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Row</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.row} className="border-b border-surface-border last:border-b-0">
                  <td className="px-4 py-2 text-muted-foreground">{r.row}</td>
                  <td className="px-4 py-2 text-foreground">{r.companyName ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.success ? (
                      <span className="text-teal-500">Imported</span>
                    ) : (
                      <span className="text-danger">{r.error}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------
// Shared modal chrome + add/edit form
// -----------------------------------------------------------------------

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <Card className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {children}
      </Card>
    </div>
  );
}

type FormState = {
  companyName: string;
  sector: string;
  subSector: string;
  state: string;
  district: string;
  notificationReference: string;
  notificationDate: string;
  status: CctsEntityStatus;
  baselineIntensity: string;
  targetIntensity: string;
  sourceUrl: string;
  lastVerifiedDate: string;
};

const emptyForm: FormState = {
  companyName: "",
  sector: "",
  subSector: "",
  state: "",
  district: "",
  notificationReference: "",
  notificationDate: "",
  status: "DRAFT",
  baselineIntensity: "",
  targetIntensity: "",
  sourceUrl: "",
  lastVerifiedDate: new Date().toISOString().slice(0, 10),
};

const formFromEntity = (entity: CctsObligatedEntity): FormState => ({
  companyName: entity.companyName,
  sector: entity.sector,
  subSector: entity.subSector ?? "",
  state: entity.state,
  district: entity.district ?? "",
  notificationReference: entity.notificationReference,
  notificationDate: toDateInput(entity.notificationDate),
  status: entity.status,
  baselineIntensity: entity.baselineIntensity !== null ? String(entity.baselineIntensity) : "",
  targetIntensity: entity.targetIntensity !== null ? String(entity.targetIntensity) : "",
  sourceUrl: entity.sourceUrl ?? "",
  lastVerifiedDate: toDateInput(entity.lastVerifiedDate),
});

function EntityFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial: FormState;
  onClose: () => void;
  onSave: (input: CreateCctsObligatedEntityInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.companyName.trim() || !form.sector.trim() || !form.state.trim() || !form.notificationReference.trim()) {
      setError("Company name, sector, state, and notification reference are required.");
      return;
    }
    if (!form.notificationDate || !form.lastVerifiedDate) {
      setError("Notification date and last verified date are required.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        companyName: form.companyName.trim(),
        sector: form.sector.trim(),
        subSector: form.subSector.trim() || undefined,
        state: form.state.trim(),
        district: form.district.trim() || undefined,
        notificationReference: form.notificationReference.trim(),
        notificationDate: form.notificationDate,
        status: form.status,
        baselineIntensity: form.baselineIntensity ? Number(form.baselineIntensity) : undefined,
        targetIntensity: form.targetIntensity ? Number(form.targetIntensity) : undefined,
        sourceUrl: form.sourceUrl.trim() || undefined,
        lastVerifiedDate: form.lastVerifiedDate,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save this entity.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="ent-companyName">Company / plant name</Label>
          <Input id="ent-companyName" value={form.companyName} onChange={set("companyName")} />
        </div>
        <div>
          <Label htmlFor="ent-sector">Sector</Label>
          <Input id="ent-sector" value={form.sector} onChange={set("sector")} placeholder="e.g. Iron & Steel" />
        </div>
        <div>
          <Label htmlFor="ent-subSector">Sub-sector</Label>
          <Input id="ent-subSector" value={form.subSector} onChange={set("subSector")} placeholder="e.g. EAF, Integrated, DRI" />
        </div>
        <div>
          <Label htmlFor="ent-state">State</Label>
          <Input id="ent-state" value={form.state} onChange={set("state")} />
        </div>
        <div>
          <Label htmlFor="ent-district">District</Label>
          <Input id="ent-district" value={form.district} onChange={set("district")} placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="ent-notificationReference">Notification reference</Label>
          <Input
            id="ent-notificationReference"
            value={form.notificationReference}
            onChange={set("notificationReference")}
            placeholder='e.g. "G.S.R. 234(E)"'
          />
        </div>
        <div>
          <Label htmlFor="ent-notificationDate">Notification date</Label>
          <Input id="ent-notificationDate" type="date" value={form.notificationDate} onChange={set("notificationDate")} />
        </div>
        <div>
          <Label htmlFor="ent-status">Status</Label>
          <Select id="ent-status" value={form.status} onChange={set("status")}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ent-lastVerifiedDate">Last verified date</Label>
          <Input id="ent-lastVerifiedDate" type="date" value={form.lastVerifiedDate} onChange={set("lastVerifiedDate")} />
        </div>
        <div>
          <Label htmlFor="ent-baselineIntensity">Baseline intensity (if published)</Label>
          <Input id="ent-baselineIntensity" type="number" step="any" value={form.baselineIntensity} onChange={set("baselineIntensity")} placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="ent-targetIntensity">Target intensity (if published)</Label>
          <Input id="ent-targetIntensity" type="number" step="any" value={form.targetIntensity} onChange={set("targetIntensity")} placeholder="Optional" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ent-sourceUrl">Source URL</Label>
          <Input id="ent-sourceUrl" value={form.sourceUrl} onChange={set("sourceUrl")} placeholder="Link to the gazette notification" />
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} isLoading={isSaving}>
          Save
        </Button>
      </div>
    </ModalShell>
  );
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------

function RegulatoryWatchContent() {
  const [entities, setEntities] = useState<CctsObligatedEntity[] | null>(null);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<CctsObligatedEntity | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    adminApi.listCctsObligatedEntities().then(({ entities }) => setEntities(entities));
  };

  useEffect(load, []);

  const filteredEntities = useMemo(() => {
    if (!entities) return null;
    const q = search.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) =>
        e.companyName.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q) ||
        e.state.toLowerCase().includes(q),
    );
  }, [entities, search]);

  const handleDelete = async (entity: CctsObligatedEntity) => {
    if (!window.confirm(`Remove ${entity.companyName} from the public tracker? This can't be undone.`)) return;
    setDeletingId(entity.id);
    setError(null);
    try {
      await adminApi.deleteCctsObligatedEntity(entity.id);
      setEntities((prev) => prev?.filter((e) => e.id !== entity.id) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this entity.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-6 text-2xl font-semibold">Regulatory Watch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CCTS Obligated Entities Tracker — manually verified against BEE gazette notifications. Nothing here is
          auto-scraped; only add or edit rows you&apos;ve personally checked against the actual notification text. Feeds
          the public /ccts-obligated-entities page.
        </p>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <div className="mt-6">
          <BulkImportPanel onImported={load} />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">All entries ({entities?.length ?? "…"})</h2>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search company, sector, or state…"
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add entity
            </Button>
          </div>
        </div>

        {filteredEntities === null && (
          <div className="mt-8 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {filteredEntities && filteredEntities.length === 0 && (
          <Card className="mt-4 p-10 text-center text-sm text-muted-foreground">
            No entries yet — this table feeds the public tracker directly, so it stays empty until you add verified
            data here (manually or via CSV import above).
          </Card>
        )}

        {filteredEntities && filteredEntities.length > 0 && (
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Sector</th>
                  <th className="px-5 py-3 font-medium">State</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Notification</th>
                  <th className="px-5 py-3 font-medium">Last verified</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map((entity) => (
                  <tr key={entity.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3 font-medium text-foreground">{entity.companyName}</td>
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
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(entity.lastVerifiedDate)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingEntity(entity)}
                          className="text-sm font-medium text-teal-500 hover:text-teal-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entity)}
                          disabled={deletingId === entity.id}
                          className="text-sm font-medium text-danger hover:text-danger/80 disabled:opacity-50"
                        >
                          {deletingId === entity.id ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>

      {showAddModal && (
        <EntityFormModal
          title="Add obligated entity"
          initial={emptyForm}
          onClose={() => setShowAddModal(false)}
          onSave={async (input) => {
            const { entity } = await adminApi.createCctsObligatedEntity(input);
            setEntities((prev) => (prev ? [...prev, entity] : [entity]));
            setShowAddModal(false);
          }}
        />
      )}

      {editingEntity && (
        <EntityFormModal
          title={`Edit — ${editingEntity.companyName}`}
          initial={formFromEntity(editingEntity)}
          onClose={() => setEditingEntity(null)}
          onSave={async (input) => {
            const { entity } = await adminApi.updateCctsObligatedEntity(editingEntity.id, input);
            setEntities((prev) => prev?.map((e) => (e.id === entity.id ? entity : e)) ?? prev);
            setEditingEntity(null);
          }}
        />
      )}
    </>
  );
}

export default function RegulatoryWatchPage() {
  return <RegulatoryWatchContent />;
}
