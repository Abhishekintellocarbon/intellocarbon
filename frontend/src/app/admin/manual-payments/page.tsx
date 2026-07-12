"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Receipt, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { adminApi, ApiError } from "@/lib/api";
import type { AdminCompanySummary, ManualPayment, ManualPaymentMode, ManualPaymentStatus, SubscriptionTier } from "@/lib/types";

const TIERS: { value: SubscriptionTier; label: string }[] = [
  { value: "CCTS_COMPLIANCE", label: "CCTS Compliance" },
  { value: "CBAM_COMPLIANCE", label: "CBAM Compliance" },
  { value: "CBAM_PLUS_CCTS", label: "CBAM + CCTS" },
  { value: "BRSR_CORE_REPORTING", label: "BRSR Core Reporting" },
];

const PAYMENT_MODES: ManualPaymentMode[] = ["CHEQUE", "NEFT", "RTGS", "UPI", "CASH", "OTHER"];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  companyId: "",
  tier: "CCTS_COMPLIANCE" as SubscriptionTier,
  amount: "",
  paymentMode: "NEFT" as ManualPaymentMode,
  referenceNumber: "",
  paymentDate: todayIso(),
  validUntil: "",
  notes: "",
};

// -----------------------------------------------------------------------
// Record-payment form
// -----------------------------------------------------------------------

function RecordPaymentForm({
  companies,
  onRecorded,
}: {
  companies: AdminCompanySummary[];
  onRecorded: (payment: ManualPayment) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.companyId) {
      setError("Select a company.");
      return;
    }
    const numericAmount = Number(form.amount);
    if (!form.amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!form.paymentDate) {
      setError("Payment date is required.");
      return;
    }
    if (!form.validUntil) {
      setError("Valid-until date is required — set it explicitly for monthly, quarterly, or annual deals.");
      return;
    }

    setIsSaving(true);
    try {
      const { payment } = await adminApi.recordManualPayment({
        companyId: form.companyId,
        tier: form.tier,
        amount: numericAmount,
        paymentMode: form.paymentMode,
        referenceNumber: form.referenceNumber.trim() || undefined,
        paymentDate: form.paymentDate,
        validUntil: form.validUntil,
        notes: form.notes.trim() || undefined,
      });
      onRecorded(payment);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record this payment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-teal-500" />
        <h2 className="font-medium">Record a payment</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        For payments collected outside Razorpay (cheque, NEFT, UPI, cash). Activates the subscription immediately,
        same as an automated payment would.
      </p>

      {error && (
        <div className="mt-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Label htmlFor="mp-company">Company</Label>
          <Select id="mp-company" value={form.companyId} onChange={set("companyId")}>
            <option value="">Select a company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="mp-tier">Tier / plan</Label>
          <Select id="mp-tier" value={form.tier} onChange={set("tier")}>
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="mp-amount">Amount (INR)</Label>
          <Input id="mp-amount" type="number" step="any" value={form.amount} onChange={set("amount")} />
        </div>
        <div>
          <Label htmlFor="mp-mode">Payment mode</Label>
          <Select id="mp-mode" value={form.paymentMode} onChange={set("paymentMode")}>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="mp-reference">Reference number</Label>
          <Input id="mp-reference" value={form.referenceNumber} onChange={set("referenceNumber")} placeholder="Cheque / UTR / txn ID" />
        </div>

        <div>
          <Label htmlFor="mp-paymentDate">Payment date</Label>
          <Input id="mp-paymentDate" type="date" value={form.paymentDate} onChange={set("paymentDate")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="mp-validUntil">Valid until</Label>
          <Input id="mp-validUntil" type="date" value={form.validUntil} onChange={set("validUntil")} />
        </div>

        <div className="sm:col-span-3">
          <Label htmlFor="mp-notes">Notes</Label>
          <textarea
            id="mp-notes"
            value={form.notes}
            onChange={set("notes")}
            rows={2}
            className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors duration-150 focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
            placeholder="Optional context for this payment"
          />
        </div>

        <div className="sm:col-span-3">
          <Button size="sm" onClick={handleSubmit} isLoading={isSaving}>
            Record payment
          </Button>
        </div>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Reverse action — inline reason field, since window.confirm can't collect
// free text and a reason is required.
// -----------------------------------------------------------------------

function ReverseAction({ payment, onReversed }: { payment: ManualPayment; onReversed: (updated: ManualPayment) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        Reverse
      </Button>
    );
  }

  const handleReverse = async () => {
    if (reason.trim().length < 5) {
      setError("Explain why this payment is being reversed.");
      return;
    }
    if (!window.confirm(`Reverse this ₹${payment.amount} payment for ${payment.company.name}? Their subscription will move to PAST_DUE.`)) {
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const { payment: updated } = await adminApi.reverseManualPayment(payment.id, reason.trim());
      onReversed(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reverse this payment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-56 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus:border-danger/60 focus:ring-2 focus:ring-danger/20"
        placeholder="Reason for reversal (required)"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="danger" isLoading={isSaving} onClick={handleReverse}>
          Confirm reverse
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------

function ManualPaymentsContent() {
  const [payments, setPayments] = useState<ManualPayment[] | null>(null);
  const [companies, setCompanies] = useState<AdminCompanySummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<ManualPaymentStatus | "">("");
  const [companyFilter, setCompanyFilter] = useState("");

  const load = () => {
    adminApi.listManualPayments({}).then(({ payments }) => setPayments(payments));
    adminApi.listCompanies().then(({ companies }) => setCompanies(companies));
  };

  useEffect(load, []);

  const filteredPayments = useMemo(() => {
    if (!payments) return null;
    return payments.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (companyFilter && p.companyId !== companyFilter) return false;
      return true;
    });
  }, [payments, statusFilter, companyFilter]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mt-6 text-2xl font-semibold">Payments & Deals</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Record payments collected outside Razorpay and manage custom subscription deals. Fully independent of
        Razorpay — every number here is entered manually.
      </p>

      <div className="mt-6">
        <RecordPaymentForm companies={companies} onRecorded={(p) => setPayments((prev) => (prev ? [p, ...prev] : [p]))} />
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">All manual payments</h2>
        <div className="flex items-center gap-3">
          <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-48">
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ManualPaymentStatus | "")} className="w-40">
            <option value="">All statuses</option>
            <option value="RECORDED">Recorded</option>
            <option value="REVERSED">Reversed</option>
          </Select>
        </div>
      </div>

      {filteredPayments === null && (
        <div className="mt-8 flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        </div>
      )}

      {filteredPayments && filteredPayments.length === 0 && (
        <Card className="mt-4 flex flex-col items-center gap-2 p-10 text-center">
          <Search className="h-5 w-5 text-teal-500" />
          <p className="text-sm text-muted-foreground">No manual payments match these filters.</p>
        </Card>
      )}

      {filteredPayments && filteredPayments.length > 0 && (
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Payment date</th>
                <th className="px-4 py-3 font-medium">Valid until</th>
                <th className="px-4 py-3 font-medium">Recorded by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr key={p.id} className="border-b border-surface-border last:border-b-0 align-top">
                  <td className="px-4 py-3 font-medium text-foreground">{p.company.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{TIERS.find((t) => t.value === p.tier)?.label ?? p.tier}</td>
                  <td className="px-4 py-3 text-right text-foreground">₹{p.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.paymentMode}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.paymentDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.validUntil)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.recordedBy.name}</td>
                  <td className="px-4 py-3">
                    {p.status === "REVERSED" ? (
                      <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                        Reversed
                      </span>
                    ) : (
                      <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                        Recorded
                      </span>
                    )}
                    {p.status === "REVERSED" && p.reversalReason && (
                      <p className="mt-1 max-w-[160px] text-[11px] text-muted-foreground">{p.reversalReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.status === "RECORDED" && (
                      <ReverseAction
                        payment={p}
                        onReversed={(updated) => setPayments((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev)}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}

export default function ManualPaymentsPage() {
  return <ManualPaymentsContent />;
}
