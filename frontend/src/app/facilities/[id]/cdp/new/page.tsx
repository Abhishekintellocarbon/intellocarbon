"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ScrollText } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { cdpReportingPeriodSchema } from "@/lib/validations/cdp";
import { CDP_APPLICABILITY_NOTICE } from "@/lib/cdp-questionnaire";

// e.g. in Jul 2026, suggests "FY2026-27" — a starting point only; the user can edit it.
const suggestedFy = (): string => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

function NewCdpReportContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [draftPeriod, setDraftPeriod] = useState(suggestedFy());
  const [periodError, setPeriodError] = useState<string | null>(null);

  const handleContinue = () => {
    const result = cdpReportingPeriodSchema.safeParse(draftPeriod);
    if (!result.success) {
      setPeriodError(result.error.issues[0]?.message ?? "Enter a valid reporting period");
      return;
    }
    setPeriodError(null);
    // Straight to the modules. Unlike GRI and CSRD there is no materiality
    // assessment to complete first — CDP asks every responding company every
    // question in the questionnaire it issues.
    router.push(`/facilities/${params.id}/cdp/${encodeURIComponent(result.data)}/edit`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <ScrollText className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Start a CDP Climate Change response</h1>
            <p className="text-sm text-muted-foreground">
              The full questionnaire — governance, risks and opportunities, strategy, targets, emissions, energy,
              verification, carbon pricing and value chain engagement.
            </p>
          </div>
        </div>

        {/* Stated before the reporting period, not after: somebody who does not
            need CDP should find that out before they start entering data. */}
        <Card className="mb-6 border-teal-500/30 p-6">
          <h2 className="font-medium">Check who asked you for this first</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{CDP_APPLICABILITY_NOTICE}</p>
        </Card>

        <Card className="max-w-sm p-6">
          <Label htmlFor="reportingPeriod">Reporting period (financial year)</Label>
          <Input
            id="reportingPeriod"
            placeholder="FY2025-26"
            value={draftPeriod}
            onChange={(e) => setDraftPeriod(e.target.value)}
            error={Boolean(periodError)}
          />
          <FieldError message={periodError ?? undefined} />
          <p className="mt-2 text-xs text-muted-foreground">
            Your emissions, energy and Scope 3 figures for this year are reused automatically — you will not re-enter
            them.
          </p>
          <Button type="button" className="mt-4 w-full" onClick={handleContinue}>
            Continue
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default function NewCdpReportPage() {
  return (
    <ProtectedRoute>
      <NewCdpReportContent />
    </ProtectedRoute>
  );
}
