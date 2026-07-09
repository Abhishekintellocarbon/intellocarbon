"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { GenerateReportModal } from "./generate-report-modal";
import { reportsApi, ApiError } from "@/lib/api";
import type { GeneratedReportType, ReportGenerationStatus } from "@/lib/types";

type DisabledReason = "EVIDENCE_PENDING" | "EVIDENCE_NOT_CROSS_CHECKED" | null;

const DISABLED_TOOLTIPS: Record<Exclude<DisabledReason, null>, string> = {
  EVIDENCE_PENDING: "Upload supporting documents to generate report.",
  EVIDENCE_NOT_CROSS_CHECKED: "All submitted evidence must be cross-checked and matched before generating a report",
};

export function GenerateReportButton({ facilityId, disabledReason }: { facilityId: string; disabledReason?: DisabledReason }) {
  const disabled = Boolean(disabledReason);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ReportGenerationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<GeneratedReportType | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refresh = () => {
    setIsLoading(true);
    return reportsApi
      .status(facilityId)
      .then(setStatus)
      .catch(() => setError("Couldn't load report options. Please try again."))
      .finally(() => setIsLoading(false));
  };

  const handleOpen = () => {
    setOpen(true);
    setError(null);
    refresh();
  };

  const handleGenerate = async (reportType: GeneratedReportType) => {
    setError(null);
    setGeneratingType(reportType);
    try {
      await reportsApi.generate(facilityId, reportType);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the report. Please try again.");
    } finally {
      setGeneratingType(null);
    }
  };

  const handleDownload = async (reportId: string, fileName: string) => {
    setError(null);
    setDownloadingId(reportId);
    try {
      await reportsApi.downloadPdf(facilityId, reportId, fileName);
    } catch {
      setError("Couldn't download the report. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={disabled ? undefined : handleOpen}
        disabled={disabled}
        title={disabledReason ? DISABLED_TOOLTIPS[disabledReason] : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-[28px] py-[12px] font-bold transition-all duration-150",
          disabled
            ? "cursor-not-allowed bg-surface-raised text-muted-foreground"
            : "bg-[#00D4AA] text-[#0F1923] shadow-[0_0_16px_rgba(0,212,170,0.5)] hover:brightness-110 active:brightness-95",
        )}
      >
        <FileText className="h-4 w-4" />
        Generate Report
      </button>

      <GenerateReportModal
        open={open}
        onClose={() => setOpen(false)}
        status={status}
        isLoading={isLoading}
        error={error}
        generatingType={generatingType}
        downloadingId={downloadingId}
        onGenerate={handleGenerate}
        onDownload={handleDownload}
      />
    </>
  );
}
