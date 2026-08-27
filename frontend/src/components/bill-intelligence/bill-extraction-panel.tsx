"use client";

import { Loader2, ScanLine, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BillExtraction, BillFieldConfidence, BillFieldProvenance } from "@/lib/types";

/**
 * IntelloAdvisor Bill Intelligence, as shown to a verifier during cross-check.
 *
 * This panel is evidence, not a verdict. It sits beside the manual comparison
 * and never touches the Confirm Match / Flag Mismatch controls: a verifier who
 * ignores it entirely reaches a decision exactly as they did before this
 * existed. Everything it shows is traceable — each value carries the line it
 * was read from and the rule that set its confidence, so a reviewer can check
 * the claim rather than trust it.
 */

const CONFIDENCE_STYLES: Record<BillFieldConfidence, string> = {
  HIGH: "border-success/30 bg-success/10 text-success",
  MEDIUM: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  LOW: "border-danger/30 bg-danger/10 text-danger",
};

const NOT_EXTRACTED_LABEL: Record<string, string> = {
  NOT_FOUND: "Not on the bill",
  AMBIGUOUS: "Conflicting readings",
  UNIT_NOT_CONVERTIBLE: "Unit can't be converted",
  OUT_OF_RANGE: "Implausible value",
  UNPARSEABLE: "Couldn't be read",
};

const fmtNumber = (n: number, maximumFractionDigits = 2) =>
  n.toLocaleString("en-IN", { maximumFractionDigits });

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

function ConfidenceBadge({ confidence }: { confidence: BillFieldConfidence }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        CONFIDENCE_STYLES[confidence],
      )}
    >
      {confidence}
    </span>
  );
}

/**
 * One extracted field.
 *
 * A field that could not be read is rendered just as prominently as one that
 * could, and says why. Hiding the gaps would leave a reviewer assuming the
 * bill was fully read when six of seven fields were blank.
 */
function ExtractedField({
  label,
  value,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  meta: BillFieldProvenance | undefined;
}) {
  const extracted = meta?.status === "EXTRACTED";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {extracted && <ConfidenceBadge confidence={meta.confidence} />}
      </div>
      {extracted ? (
        <>
          <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
          {/* The source line and the rule behind the band, on hover and in the
              DOM — a verifier challenging a number needs the evidence, not a
              colour. */}
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground" title={meta.rawText}>
            {meta.reason}
          </p>
        </>
      ) : (
        <>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {NOT_EXTRACTED_LABEL[meta?.reason ?? "NOT_FOUND"] ?? "Not read"}
          </p>
          {meta?.status === "NOT_EXTRACTED" && meta.detail && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{meta.detail}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Submitted Scope 2 figure against the bill's, in the same unit.
 *
 * This is the comparison the verifier is actually here to make, so it is
 * computed and shown rather than left as arithmetic between two panels. It
 * states a difference; it does not call it a mismatch. Grid electricity is
 * legitimately not the same as one bill's units — a facility can hold several
 * connections, or the bill's cycle may not match the reporting period — and
 * deciding whether a gap is explained is the reviewer's job.
 */
function Scope2Comparison({ submittedMwh, billKwh }: { submittedMwh: number | null; billKwh: number }) {
  const billMwh = billKwh / 1000;
  if (submittedMwh == null) {
    return (
      <p className="text-xs text-muted-foreground">
        Bill shows <span className="font-medium text-foreground">{fmtNumber(billMwh, 3)} MWh</span> ({fmtNumber(billKwh)} kWh).
        No grid electricity figure was submitted for this period.
      </p>
    );
  }

  const diff = submittedMwh - billMwh;
  const pct = billMwh === 0 ? null : (diff / billMwh) * 100;
  const matches = Math.abs(diff) < 0.0005;

  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-muted-foreground">
          Submitted <span className="font-medium text-foreground">{fmtNumber(submittedMwh, 3)} MWh</span>
        </span>
        <span className="text-muted-foreground">
          Bill <span className="font-medium text-foreground">{fmtNumber(billMwh, 3)} MWh</span> ({fmtNumber(billKwh)} kWh)
        </span>
      </div>
      <p className={cn("mt-1 font-medium", matches ? "text-success" : "text-amber-500")}>
        {matches
          ? "The submitted figure equals this bill's units."
          : `Difference: ${diff > 0 ? "+" : ""}${fmtNumber(diff, 3)} MWh${pct !== null ? ` (${diff > 0 ? "+" : ""}${fmtNumber(pct, 1)}%)` : ""}`}
      </p>
      {!matches && (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          A difference is not automatically a mismatch — a facility may draw from more than one connection, and a billing
          cycle need not line up with the reporting period. Confirm or flag on your own reading of the document.
        </p>
      )}
    </div>
  );
}

export function BillExtractionPanel({
  extraction,
  submittedGridElectricityMwh,
}: {
  extraction: BillExtraction | null;
  /** The value the client submitted, for the side-by-side. Null when they submitted none. */
  submittedGridElectricityMwh: number | null;
}) {
  // No extraction at all: documents predating this feature, and anything whose
  // queueing failed. Render nothing rather than an empty shell — the manual
  // comparison above is the whole product in that case.
  if (!extraction) return null;

  if (extraction.status === "PENDING") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
        Reading this bill…
      </div>
    );
  }

  if (extraction.status !== "COMPLETED") {
    return (
      <div className="mt-4 rounded-lg border border-surface-border bg-surface-raised px-3 py-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <TriangleAlert className="h-3.5 w-3.5" />
          This document couldn&apos;t be read automatically
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {extraction.failureReason === "NO_TEXT_LAYER"
            ? "It carries no readable text — most likely a scan or photo saved as a PDF."
            : extraction.failureReason === "ENCRYPTED_PDF"
              ? "It is password-protected."
              : extraction.failureReason === "UNSUPPORTED"
                ? "Its file type carries no extractable text."
                : "Extraction did not complete."}{" "}
          Compare the document manually, as usual.
        </p>
      </div>
    );
  }

  const f = extraction.fields;
  const m = extraction.fieldMeta;
  const period =
    f.billingPeriodStart && f.billingPeriodEnd ? `${fmtDate(f.billingPeriodStart)} – ${fmtDate(f.billingPeriodEnd)}` : null;

  return (
    <div className="mt-4 rounded-lg border border-surface-border bg-surface-raised p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ScanLine className="h-3.5 w-3.5 text-teal-500" />
          Read from this bill
        </p>
        <p className="text-[11px] text-muted-foreground">
          {extraction.engine === "PDF_TEXT_LAYER"
            ? "PDF text layer — characters read exactly, no OCR"
            : `OCR${extraction.ocrMeanConfidence != null ? ` · ${Math.round(extraction.ocrMeanConfidence)}% page confidence` : ""}`}
        </p>
      </div>

      {f.unitsConsumedKwh != null && (
        <div className="mt-3 rounded-lg border border-surface-border bg-surface p-3">
          <Scope2Comparison submittedMwh={submittedGridElectricityMwh} billKwh={f.unitsConsumedKwh} />
        </div>
      )}

      {extraction.scope2Suggestion?.accepted && (
        <p className="mt-2 text-[11px] leading-snug text-teal-500">
          The client took the submitted grid electricity figure from this bill&apos;s extracted units rather than typing
          their own. They could still have edited it afterwards.
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ExtractedField
          label="Units consumed"
          value={f.unitsConsumedKwh != null ? `${fmtNumber(f.unitsConsumedKwh)} kWh` : null}
          meta={m.unitsConsumedKwh}
        />
        <ExtractedField label="Billing period" value={period} meta={m.billingPeriod} />
        <ExtractedField
          label="Rate per unit"
          value={f.ratePerUnitInr != null ? `₹${fmtNumber(f.ratePerUnitInr)}` : null}
          meta={m.ratePerUnitInr}
        />
        <ExtractedField
          label="Tariff category"
          value={[f.tariffCode, f.tariffVoltage, f.tariffSegment].filter(Boolean).join(" · ") || null}
          meta={m.tariff}
        />
        <ExtractedField
          label="Sanctioned load"
          value={f.sanctionedLoadValue != null ? `${fmtNumber(f.sanctionedLoadValue)} ${f.sanctionedLoadUnit ?? ""}`.trim() : null}
          meta={m.sanctionedLoad}
        />
        <ExtractedField label="Discom" value={f.discomName} meta={m.discom} />
        <ExtractedField label="State" value={f.state} meta={m.state} />
      </div>

      <p className="mt-3 border-t border-surface-border pt-2 text-[11px] leading-snug text-muted-foreground">
        Extracted text only — no figure here was estimated, inferred, or filled in from another field. Anything the bill
        did not state plainly is left blank above. This is reference material for your review; the match decision remains
        yours.
      </p>
    </div>
  );
}
