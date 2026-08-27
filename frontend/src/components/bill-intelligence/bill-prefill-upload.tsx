"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { billIntelligenceApi, documentsApi, ApiError } from "@/lib/api";
import type { BillExtraction } from "@/lib/types";

/**
 * IntelloAdvisor Bill Intelligence, client side: upload an electricity bill
 * against the entry being drafted, and offer its units as the Scope 2 figure.
 *
 * Two rules govern everything here, and they are not the same rule:
 *
 *   - Pre-fill only into an empty field. If the client has already typed a
 *     grid electricity figure, this component will not write over it, full
 *     stop. It offers a Replace button and waits to be clicked.
 *   - Suggest, never assert. Every number shown is accompanied by the line it
 *     was read from, and an auto-fill into an empty field is announced and
 *     undoable rather than silent.
 *
 * If extraction fails, times out, or returns nothing usable, this collapses to
 * a note and the client types the figure as they always have. The upload
 * itself has already succeeded by then and is attached to the entry either
 * way, so the evidence trail and the verifier's manual cross-check are
 * unaffected by anything that happens after it.
 */

const POLL_INTERVAL_MS = 1_500;
/** Slightly beyond the server's own 60s OCR ceiling, so the server decides the outcome, not the browser. */
const POLL_TIMEOUT_MS = 75_000;

const fmt = (n: number, digits = 3) => n.toLocaleString("en-IN", { maximumFractionDigits: digits });

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "reading" }
  | { kind: "done"; extraction: BillExtraction }
  | { kind: "error"; message: string };

export function BillPrefillUpload({
  facilityId,
  ensureDraftId,
  currentValueMwh,
  onUseValue,
}: {
  facilityId: string;
  /** Resolves the draft entry's id, creating the draft first if it doesn't exist yet. */
  ensureDraftId: () => Promise<string>;
  /** The raw form value, so an empty string is distinguishable from a typed 0. */
  currentValueMwh: string;
  /** Writes the field. `null` clears it, which is what Undo restores to. */
  onUseValue: (mwh: number | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [autoFilled, setAutoFilled] = useState<{ previous: string } | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const applyValue = async (documentId: string, mwh: number) => {
    onUseValue(mwh);
    // Recorded separately from the value: this endpoint stores only that the
    // client took the bill's figure, which is what a verifier later reads.
    // A failure here must not undo a pre-fill the client can see, so it is
    // swallowed — the value is the product, the provenance flag is a bonus.
    await billIntelligenceApi.acceptPrefill(facilityId, documentId).catch(() => undefined);
  };

  const poll = async (documentId: string) => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      if (cancelled.current) return;
      const { extraction } = await billIntelligenceApi.get(facilityId, documentId);

      if (!extraction) {
        setPhase({ kind: "error", message: "This bill wasn't queued for reading. Enter the figure manually." });
        return;
      }
      if (extraction.status !== "PENDING") {
        if (cancelled.current) return;
        setPhase({ kind: "done", extraction });

        // The one place a value is written without a click — and only ever
        // into a field the client has left empty, so nothing they typed is
        // touched. It is announced and undoable, not silent.
        const suggestion = extraction.scope2Suggestion;
        if (suggestion && currentValueMwh.trim() === "") {
          setAutoFilled({ previous: currentValueMwh });
          await applyValue(documentId, suggestion.suggestedValueMwh);
        }
        return;
      }
      if (Date.now() > deadline) {
        setPhase({
          kind: "error",
          message: "Reading this bill is taking longer than expected. Enter the figure manually — the document is uploaded and attached.",
        });
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    cancelled.current = false;
    setAutoFilled(null);
    setPhase({ kind: "uploading" });
    try {
      // Creates the draft entry if this is a brand-new form, because a
      // document can only be attached to an activity data row that exists.
      const dataId = await ensureDraftId();
      const { document } = await documentsApi.uploadEvidence(facilityId, dataId, file);
      if (cancelled.current) return;
      setPhase({ kind: "reading" });
      await poll(document.id);
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof ApiError ? err.message : "Couldn't upload this bill. You can still enter the figure manually.",
      });
    }
  };

  const doneExtraction = phase.kind === "done" ? phase.extraction : null;
  const suggestion = doneExtraction?.scope2Suggestion ?? null;
  const currentNumber = currentValueMwh.trim() === "" ? null : Number(currentValueMwh);
  const matchesTyped =
    suggestion && currentNumber !== null && Math.abs(currentNumber - suggestion.suggestedValueMwh) < 0.0005;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ScanLine className="h-3.5 w-3.5 text-teal-500" />
        Read this figure off your electricity bill
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Upload the bill for this period and we&apos;ll read the units consumed off it. A PDF downloaded from your discom
        portal reads best; a photo works if it&apos;s straight, sharp, and shows the whole page. Nothing is filled in
        over anything you&apos;ve already typed.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPhase({ kind: "idle" });
          }}
          className="block w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          disabled={!file}
          isLoading={phase.kind === "uploading" || phase.kind === "reading"}
          onClick={handleUpload}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload &amp; read
        </Button>
      </div>

      {phase.kind === "reading" && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin text-teal-500" />
          Reading the bill… this can take a few seconds for a photo.
        </p>
      )}

      {phase.kind === "error" && <p className="mt-2 text-[11px] leading-snug text-amber-500">{phase.message}</p>}

      {phase.kind === "done" && !suggestion && (
        <p className="mt-2 text-[11px] leading-snug text-amber-500">
          {phase.extraction.status === "COMPLETED"
            ? "We couldn't read a usable consumption figure off this bill, so nothing has been suggested. Enter the units manually — the bill is uploaded and attached to this entry for your verifier."
            : "This bill couldn't be read automatically. Enter the units manually — the bill is uploaded and attached to this entry for your verifier."}
        </p>
      )}

      {suggestion && (
        <div className="mt-3 rounded-lg border border-surface-border bg-surface p-3">
          <p className="text-xs text-foreground">
            Bill shows <span className="font-semibold">{fmt(suggestion.unitsConsumedKwh, 0)} kWh</span> ={" "}
            <span className="font-semibold">{fmt(suggestion.suggestedValueMwh)} MWh</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground" title={suggestion.rawText}>
            {suggestion.reason}
          </p>

          {autoFilled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-medium text-teal-500">Filled into Grid electricity purchased for you.</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onUseValue(autoFilled.previous.trim() === "" ? null : Number(autoFilled.previous));
                  setAutoFilled(null);
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
          ) : matchesTyped ? (
            <p className="mt-2 text-[11px] font-medium text-success">This matches the figure you entered.</p>
          ) : (
            <div className="mt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => doneExtraction && applyValue(doneExtraction.documentId, suggestion.suggestedValueMwh)}
              >
                Replace {fmt(currentNumber ?? 0)} MWh with {fmt(suggestion.suggestedValueMwh)} MWh
              </Button>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                You&apos;ve already entered a figure, so nothing has been changed. Keep yours, or replace it with the
                bill&apos;s.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
