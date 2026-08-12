"use client";

import { useCallback, useEffect, useState } from "react";
import { Leaf, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/field-error";
import { DraftBadge, SubmittedBadge } from "@/components/ui/draft-badge";
import { ApiError, voluntaryOffsetApi } from "@/lib/api";
import { OFFSET_CATEGORY_LABELS, OFFSET_REGISTRY_LABELS } from "@/lib/constants";
import type { OffsetCategory, OffsetRegistry, OffsetTotals, VoluntaryOffsetPurchase } from "@/lib/types";

/**
 * Voluntary carbon credit purchase log for one facility.
 *
 * A tracking record, not an assurance product: Intellocarbon does not verify,
 * rate or issue anything here, so the form checks formats only (tonnage above
 * zero, a whole vintage year, a serial that isn't blank) and stores the rest
 * verbatim. That claim is stated in the UI too, so nobody reads a logged
 * purchase as a validated one.
 */

const fmtTonnes = (n: number) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} tCO2e`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const toDateInputValue = (iso: string) => iso.slice(0, 10);

interface FormState {
  registry: string;
  creditSerialNumber: string;
  tonnageTco2e: string;
  category: string;
  vintageYear: string;
  purchaseDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  registry: "",
  creditSerialNumber: "",
  tonnageTco2e: "",
  category: "",
  vintageYear: "",
  purchaseDate: "",
  notes: "",
};

const toFormState = (purchase: VoluntaryOffsetPurchase): FormState => ({
  registry: purchase.registry,
  creditSerialNumber: purchase.creditSerialNumber,
  tonnageTco2e: String(purchase.tonnageTco2e),
  category: purchase.category,
  vintageYear: String(purchase.vintageYear),
  purchaseDate: toDateInputValue(purchase.purchaseDate),
  notes: purchase.notes ?? "",
});

/**
 * Format checks only — deliberately the same set the server enforces, so the
 * user sees them inline rather than as a 400. Nothing here judges whether a
 * credit is real or good.
 */
const validate = (form: FormState): Partial<Record<keyof FormState, string>> => {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.registry) errors.registry = "Select a registry";
  if (!form.creditSerialNumber.trim()) errors.creditSerialNumber = "Enter the credit serial number";
  if (!form.category) errors.category = "Select a category";
  if (!form.purchaseDate) errors.purchaseDate = "Select a purchase date";

  const tonnage = Number(form.tonnageTco2e);
  if (!form.tonnageTco2e || Number.isNaN(tonnage) || tonnage <= 0) {
    errors.tonnageTco2e = "Enter a tonnage greater than 0";
  }

  const vintage = Number(form.vintageYear);
  if (!form.vintageYear || !Number.isInteger(vintage) || vintage < 1990 || vintage > 2100) {
    errors.vintageYear = "Enter a vintage year between 1990 and 2100";
  }

  return errors;
};

export function VoluntaryOffsetsSection({ facilityId }: { facilityId: string }) {
  const [purchases, setPurchases] = useState<VoluntaryOffsetPurchase[]>([]);
  const [totals, setTotals] = useState<OffsetTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notSubscribed, setNotSubscribed] = useState(false);

  // null = form closed; "new" = adding; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { purchases: rows, totals: t } = await voluntaryOffsetApi.list(facilityId);
      setPurchases(rows);
      setTotals(t);
      setLoadError(null);
    } catch (err) {
      // The section simply doesn't render for a company without the bundle —
      // the same treatment the ESG Overview gives an unsubscribed company,
      // rather than an error the user can do nothing about here.
      if (err instanceof ApiError && err.code === "ESG_BUNDLE_NOT_SUBSCRIBED") {
        setNotSubscribed(true);
      } else {
        setLoadError("Couldn't load offset purchases.");
      }
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSaveError(null);
    setEditing("new");
  };

  const openEdit = (purchase: VoluntaryOffsetPurchase) => {
    setForm(toFormState(purchase));
    setErrors({});
    setSaveError(null);
    setEditing(purchase.id);
  };

  const closeForm = () => {
    setEditing(null);
    setErrors({});
    setSaveError(null);
  };

  const save = async (submit: boolean) => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        registry: form.registry,
        creditSerialNumber: form.creditSerialNumber.trim(),
        tonnageTco2e: Number(form.tonnageTco2e),
        category: form.category,
        vintageYear: Number(form.vintageYear),
        purchaseDate: form.purchaseDate,
        notes: form.notes.trim() || undefined,
      };

      if (editing === "new") {
        await voluntaryOffsetApi.create(facilityId, payload, submit);
      } else if (editing) {
        await voluntaryOffsetApi.update(facilityId, editing, payload, submit);
      }
      await load();
      closeForm();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't save this purchase. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (purchaseId: string) => {
    setDeletingId(purchaseId);
    try {
      await voluntaryOffsetApi.remove(facilityId, purchaseId);
      await load();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't delete this purchase.");
    } finally {
      setDeletingId(null);
    }
  };

  if (notSubscribed) return null;

  return (
    <>
      <div className="mt-10 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Voluntary offsets</h2>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Log offset purchase
          </Button>
        )}
      </div>

      {loadError && (
        <div className="mb-4">
          <Alert variant="error">{loadError}</Alert>
        </div>
      )}

      {editing && (
        <Card className="mb-4 p-6">
          <h3 className="font-medium">{editing === "new" ? "Log an offset purchase" : "Edit offset purchase"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Recorded exactly as you enter it. Intellocarbon does not verify, rate, or issue carbon credits — this is
            your own purchase log.
          </p>

          {saveError && (
            <div className="mt-4">
              <Alert variant="error">{saveError}</Alert>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="offset-registry">Registry</Label>
              <Select
                id="offset-registry"
                value={form.registry}
                error={Boolean(errors.registry)}
                onChange={(e) => setForm((f) => ({ ...f, registry: e.target.value }))}
              >
                <option value="">Select registry</option>
                {(Object.keys(OFFSET_REGISTRY_LABELS) as OffsetRegistry[]).map((key) => (
                  <option key={key} value={key}>
                    {OFFSET_REGISTRY_LABELS[key]}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.registry} />
            </div>

            <div>
              <Label htmlFor="offset-serial">Credit serial number</Label>
              <Input
                id="offset-serial"
                placeholder="e.g. 1234-567891011-1213141516-VCS-VCU-000-00-0000"
                value={form.creditSerialNumber}
                error={Boolean(errors.creditSerialNumber)}
                onChange={(e) => setForm((f) => ({ ...f, creditSerialNumber: e.target.value }))}
              />
              <FieldError message={errors.creditSerialNumber} />
            </div>

            <div>
              <Label htmlFor="offset-category">Category</Label>
              <Select
                id="offset-category"
                value={form.category}
                error={Boolean(errors.category)}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {(Object.keys(OFFSET_CATEGORY_LABELS) as OffsetCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {OFFSET_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.category} />
            </div>

            <div>
              <Label htmlFor="offset-tonnage">Tonnage (tCO2e)</Label>
              <Input
                id="offset-tonnage"
                type="number"
                step="any"
                placeholder="1000"
                value={form.tonnageTco2e}
                error={Boolean(errors.tonnageTco2e)}
                onChange={(e) => setForm((f) => ({ ...f, tonnageTco2e: e.target.value }))}
              />
              <FieldError message={errors.tonnageTco2e} />
            </div>

            <div>
              <Label htmlFor="offset-vintage">Vintage year</Label>
              <Input
                id="offset-vintage"
                type="number"
                step="1"
                placeholder="2024"
                value={form.vintageYear}
                error={Boolean(errors.vintageYear)}
                onChange={(e) => setForm((f) => ({ ...f, vintageYear: e.target.value }))}
              />
              <FieldError message={errors.vintageYear} />
            </div>

            <div>
              <Label htmlFor="offset-purchase-date">Purchase date</Label>
              <Input
                id="offset-purchase-date"
                type="date"
                value={form.purchaseDate}
                error={Boolean(errors.purchaseDate)}
                onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
              />
              <FieldError message={errors.purchaseDate} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="offset-notes">Notes (optional)</Label>
              <Input
                id="offset-notes"
                placeholder="Project name, broker, or anything else worth recording"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button size="sm" onClick={() => save(true)} isLoading={saving}>
              Save &amp; submit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => save(false)} disabled={saving}>
              Save as draft
            </Button>
            <Button size="sm" variant="ghost" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </Card>
      ) : purchases.length === 0 ? (
        !editing && (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Leaf className="h-5 w-5 text-teal-500" />
            </span>
            <h3 className="font-medium">No offset purchases logged yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Log retired carbon credits against this facility to track them alongside your emissions. Tracking
              only — nothing here is verified or rated by Intellocarbon.
            </p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Log offset purchase
            </Button>
          </Card>
        )
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-surface-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Registry</th>
                  <th className="px-5 py-3 font-medium">Serial number</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 text-right font-medium">Tonnage</th>
                  <th className="px-5 py-3 text-right font-medium">Vintage</th>
                  <th className="px-5 py-3 font-medium">Purchased</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-surface-border last:border-0">
                    <td className="px-5 py-3">{OFFSET_REGISTRY_LABELS[purchase.registry]}</td>
                    <td className="max-w-[220px] truncate px-5 py-3 font-mono text-xs" title={purchase.creditSerialNumber}>
                      {purchase.creditSerialNumber}
                    </td>
                    <td className="px-5 py-3">{OFFSET_CATEGORY_LABELS[purchase.category]}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtTonnes(purchase.tonnageTco2e)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{purchase.vintageYear}</td>
                    <td className="px-5 py-3">{fmtDate(purchase.purchaseDate)}</td>
                    <td className="px-5 py-3">
                      {purchase.status === "DRAFT" ? <DraftBadge /> : <SubmittedBadge />}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(purchase)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border text-muted hover:border-teal-500/40 hover:text-teal-500"
                          aria-label="Edit offset purchase"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(purchase.id)}
                          disabled={deletingId === purchase.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border text-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                          aria-label="Delete offset purchase"
                        >
                          {deletingId === purchase.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totals && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border bg-surface-raised px-5 py-3 text-sm">
              <span className="text-muted-foreground">
                {totals.purchaseCount} submitted purchase{totals.purchaseCount === 1 ? "" : "s"}
                {purchases.length > totals.purchaseCount && " (drafts excluded)"}
              </span>
              <span className="font-medium">{fmtTonnes(totals.totalTonnage)} offset</span>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
