/**
 * IntelloAdvisor Bill Intelligence — orchestration.
 *
 * Sits alongside the existing evidence-upload and cross-check pipe without
 * altering either. It reads an already-stored document, writes what it could
 * read to bill_extractions, and stops. It never writes to ActivityData: the
 * Scope 2 pre-fill is a suggestion the client's browser may act on, and the
 * write that follows is the client's own autosave through the existing draft
 * endpoint, subject to the same validation as anything they type.
 */
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { requireAccessibleFacility } from "../facility.service";
import { extractText } from "./textExtraction";
import { parseBillFields, type FieldProvenance } from "./fieldParser";
import type { BillExtraction } from "@prisma/client";

/**
 * A PENDING row older than this is reported as FAILED.
 *
 * Extraction runs in-process, so a deploy or a crash mid-run leaves a row
 * PENDING with nothing left to finish it. Ageing it out on read rather than
 * writing a "failed" row from a sweeper keeps this to one rule in one place,
 * and means the UI stops polling instead of spinning forever.
 */
const STALE_PENDING_MS = 5 * 60 * 1000;

/** Confidence bands the Scope 2 pre-fill may be offered from. */
const PREFILL_CONFIDENCES = new Set(["HIGH", "MEDIUM"]);

export type BillExtractionView = ReturnType<typeof toView>;

const fieldMetaOf = (extraction: BillExtraction): Record<string, FieldProvenance> =>
  (extraction.fieldMeta as Record<string, FieldProvenance> | null) ?? {};

/**
 * The Scope 2 suggestion, or null.
 *
 * kWh to MWh is a fixed factor, applied here rather than in the browser so the
 * client and the verifier are always looking at the same converted number. It
 * is offered only from HIGH or MEDIUM confidence: a LOW-confidence reading is
 * still shown to the verifier as context, but is not put in front of a client
 * as something to accept with one click.
 */
const buildScope2Suggestion = (extraction: BillExtraction) => {
  const meta = fieldMetaOf(extraction).unitsConsumedKwh;
  if (extraction.unitsConsumedKwh == null) return null;
  if (!meta || meta.status !== "EXTRACTED" || !PREFILL_CONFIDENCES.has(meta.confidence)) return null;
  return {
    field: "gridElectricityMwh" as const,
    unitsConsumedKwh: extraction.unitsConsumedKwh,
    // The form's field is MWh; the bill prints kWh. Both are surfaced so the
    // client can check the conversion rather than take it on trust.
    suggestedValueMwh: extraction.unitsConsumedKwh / 1000,
    confidence: meta.confidence,
    reason: meta.reason,
    rawText: meta.rawText,
    accepted: extraction.prefillAcceptedAt !== null,
  };
};

const toView = (extraction: BillExtraction) => {
  // Age-out is applied to the view only. The stored row keeps saying PENDING,
  // which is the truth about what happened, and stays diagnosable.
  const stale =
    extraction.status === "PENDING" && Date.now() - extraction.startedAt.getTime() > STALE_PENDING_MS;

  return {
    documentId: extraction.documentId,
    status: stale ? ("FAILED" as const) : extraction.status,
    engine: extraction.engine,
    failureReason: stale ? "INTERRUPTED" : extraction.failureReason,
    fields: {
      state: extraction.state,
      discomName: extraction.discomName,
      discomCode: extraction.discomCode,
      unitsConsumedKwh: extraction.unitsConsumedKwh,
      tariffCode: extraction.tariffCode,
      tariffVoltage: extraction.tariffVoltage,
      tariffSegment: extraction.tariffSegment,
      sanctionedLoadValue: extraction.sanctionedLoadValue,
      sanctionedLoadUnit: extraction.sanctionedLoadUnit,
      billingPeriodStart: extraction.billingPeriodStart,
      billingPeriodEnd: extraction.billingPeriodEnd,
      ratePerUnitInr: extraction.ratePerUnitInr,
    },
    fieldMeta: fieldMetaOf(extraction),
    ocrMeanConfidence: extraction.ocrMeanConfidence,
    scope2Suggestion: stale ? null : buildScope2Suggestion(extraction),
    completedAt: extraction.completedAt,
  };
};

/**
 * Runs extraction for one already-persisted document and records the outcome.
 *
 * Exported so tests can await it directly. Production goes through
 * `queueExtraction`, which is the same call without the await.
 */
export const runExtraction = async (documentId: string, fileBuffer: Buffer): Promise<void> => {
  try {
    const result = await extractText(fileBuffer);

    if (!result.ok) {
      await prisma.billExtraction.update({
        where: { documentId },
        data: {
          status: result.reason === "UNSUPPORTED_FILE_TYPE" ? "UNSUPPORTED" : "FAILED",
          failureReason: result.reason,
          fieldMeta: { failure: { status: "NOT_EXTRACTED", reason: "NOT_FOUND", detail: result.detail } },
          completedAt: new Date(),
        },
      });
      return;
    }

    const parsed = parseBillFields(result.text, { ocrMeanConfidence: result.ocrMeanConfidence });

    await prisma.billExtraction.update({
      where: { documentId },
      data: {
        status: "COMPLETED",
        engine: result.engine,
        failureReason: null,
        state: parsed.state,
        discomName: parsed.discomName,
        discomCode: parsed.discomCode,
        unitsConsumedKwh: parsed.unitsConsumedKwh,
        tariffCode: parsed.tariffCode,
        tariffVoltage: parsed.tariffVoltage,
        tariffSegment: parsed.tariffSegment,
        sanctionedLoadValue: parsed.sanctionedLoadValue,
        sanctionedLoadUnit: parsed.sanctionedLoadUnit,
        billingPeriodStart: parsed.billingPeriodStart,
        billingPeriodEnd: parsed.billingPeriodEnd,
        ratePerUnitInr: parsed.ratePerUnitInr,
        fieldMeta: parsed.fieldMeta as object,
        extractedText: result.text.slice(0, MAX_STORED_TEXT_CHARS),
        ocrMeanConfidence: result.ocrMeanConfidence,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    // Extraction failing must never be visible as anything but "we couldn't
    // read this bill" — the upload already succeeded and the manual flow is
    // fully intact behind it.
    await prisma.billExtraction
      .update({
        where: { documentId },
        data: { status: "FAILED", failureReason: "INTERNAL_ERROR", completedAt: new Date() },
      })
      .catch(() => undefined);
    console.error(`[billIntelligence] extraction failed for document ${documentId}:`, err);
  }
};

/** Bounded so a pathological PDF can't put megabytes of text in every row. */
const MAX_STORED_TEXT_CHARS = 20_000;

/**
 * Creates the PENDING row and starts extraction without awaiting it.
 *
 * Deliberately not awaited by the upload request: OCR on a 10MB photo takes
 * seconds, and an upload that times out is a worse product than one that
 * returns immediately and fills in the extraction a moment later. The client
 * polls; nothing depends on the result arriving.
 */
export const queueExtraction = async (documentId: string, fileBuffer: Buffer): Promise<void> => {
  await prisma.billExtraction.upsert({
    where: { documentId },
    create: { documentId, status: "PENDING" },
    update: { status: "PENDING", failureReason: null, completedAt: null, startedAt: new Date() },
  });

  void runExtraction(documentId, fileBuffer);
};

const requireDocumentInFacility = async (userId: string, facilityId: string, documentId: string) => {
  await requireAccessibleFacility(userId, facilityId);
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.facilityId !== facilityId) {
    throw AppError.notFound("Document not found");
  }
  return document;
};

/**
 * Client-facing read. Returns null — not a 404 — when a document has no
 * extraction at all, which is the case for every document uploaded before this
 * feature shipped. Callers render the manual flow on null.
 */
export const getExtractionForDocument = async (
  userId: string,
  facilityId: string,
  documentId: string,
): Promise<BillExtractionView | null> => {
  await requireDocumentInFacility(userId, facilityId, documentId);
  const extraction = await prisma.billExtraction.findUnique({ where: { documentId } });
  return extraction ? toView(extraction) : null;
};

/**
 * Records that the client took the suggested Scope 2 figure.
 *
 * Stores only the fact, never the value: the client can edit the field
 * afterwards, and a stored copy here would quietly disagree with ActivityData.
 * What a verifier needs from this is the provenance — "this number came off
 * the bill" versus "this number was typed" — and that survives an edit.
 */
export const recordPrefillAccepted = async (
  userId: string,
  facilityId: string,
  documentId: string,
): Promise<BillExtractionView> => {
  await requireDocumentInFacility(userId, facilityId, documentId);
  const extraction = await prisma.billExtraction.findUnique({ where: { documentId } });
  if (!extraction) throw AppError.notFound("No extraction exists for this document");
  if (!buildScope2Suggestion(extraction)) {
    throw AppError.badRequest("This bill has no Scope 2 suggestion to accept", "NO_SUGGESTION");
  }
  const updated = await prisma.billExtraction.update({
    where: { documentId },
    data: { prefillAcceptedAt: new Date() },
  });
  return toView(updated);
};

/** Shared with the cross-check read path so the verifier sees the same view the client saw. */
export const toBillExtractionView = toView;
