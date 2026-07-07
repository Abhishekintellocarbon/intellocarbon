"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Lock, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { GeneratedReportType, ReportCardStatus, ReportGenerationStatus } from "@/lib/types";

const REPORT_TYPE_META: Record<GeneratedReportType, { title: string; description: string }> = {
  CBAM: { title: "CBAM Communication Package", description: "EU Carbon Border Adjustment Mechanism quarterly declaration." },
  CCTS: { title: "CCTS GHG Intensity Report", description: "India's Carbon Credit Trading Scheme annual GHG intensity report." },
  BRSR: { title: "BRSR Core Report", description: "SEBI BRSR Core — the 9 mandated ESG attributes." },
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function ReportCard({
  card,
  isGenerating,
  isDownloading,
  onGenerate,
  onDownload,
}: {
  card: ReportCardStatus;
  isGenerating: boolean;
  isDownloading: boolean;
  onGenerate: () => void;
  onDownload: () => void;
}) {
  const meta = REPORT_TYPE_META[card.reportType];

  return (
    <Card className="flex flex-col p-5">
      <h3 className="font-semibold text-foreground">{meta.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>

      <div className="mt-4 flex-1">
        {card.existingReport ? (
          <div className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              {card.period.displayLabel} Report — Generated on {fmtDateTime(card.existingReport.generatedAt)}
            </span>
          </div>
        ) : card.period.isOpen ? (
          <div className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-500">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{card.period.displayLabel} Report — Available Now</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>Next report available {fmtDate(card.period.windowStart)}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {card.existingReport ? (
          <>
            <Button size="sm" className="flex-1" isLoading={isDownloading} onClick={onDownload}>
              Download
            </Button>
            <Button size="sm" variant="secondary" className="flex-1" disabled title="Regeneration isn't available yet">
              Regenerate
            </Button>
          </>
        ) : (
          <Button size="sm" className="w-full" disabled={!card.period.isOpen} isLoading={isGenerating} onClick={onGenerate}>
            Generate
          </Button>
        )}
      </div>
    </Card>
  );
}

export function GenerateReportModal({
  open,
  onClose,
  status,
  isLoading,
  error,
  generatingType,
  downloadingId,
  onGenerate,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  status: ReportGenerationStatus | null;
  isLoading: boolean;
  error: string | null;
  generatingType: GeneratedReportType | null;
  downloadingId: string | null;
  onGenerate: (reportType: GeneratedReportType) => void;
  onDownload: (reportId: string, fileName: string) => void;
}) {
  if (!open) return null;

  const visibleCards = status?.cards.filter((c) => c.hasAccess) ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <Card className={cn("relative w-full p-6", status?.hasAnySubscription ? "max-w-3xl" : "max-w-md")}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-foreground">Generate Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a compliance report to generate for this facility.</p>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {isLoading && !status && <p className="mt-6 text-sm text-muted-foreground">Loading report options…</p>}

        {status && !status.hasAnySubscription && (
          <div className="mt-6 flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
              <Lock className="h-5 w-5 text-teal-500" />
            </span>
            <p className="text-sm text-foreground">Subscribe to a plan to generate compliance reports.</p>
            <Link href="/billing">
              <Button size="sm">View plans</Button>
            </Link>
          </div>
        )}

        {status && status.hasAnySubscription && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCards.map((card) => (
              <ReportCard
                key={card.reportType}
                card={card}
                isGenerating={generatingType === card.reportType}
                isDownloading={downloadingId === card.existingReport?.id}
                onGenerate={() => onGenerate(card.reportType)}
                onDownload={() => card.existingReport && onDownload(card.existingReport.id, card.existingReport.pdfPath)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
