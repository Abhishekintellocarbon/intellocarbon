"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { BrsrCoreForm } from "@/components/brsr/brsr-core-form";
import { reportingPeriodSchema } from "@/lib/validations/brsr";

// e.g. in Jul 2026, suggests "FY2026-27" — a starting point only; the user can edit it.
const suggestedFy = (): string => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

function NewBrsrReportContent() {
  const params = useParams<{ id: string }>();
  const [period, setPeriod] = useState<string | null>(null);
  const [draftPeriod, setDraftPeriod] = useState(suggestedFy());
  const [periodError, setPeriodError] = useState<string | null>(null);

  const handleContinue = () => {
    const result = reportingPeriodSchema.safeParse(draftPeriod);
    if (!result.success) {
      setPeriodError(result.error.issues[0]?.message ?? "Enter a valid reporting period");
      return;
    }
    setPeriodError(null);
    setPeriod(result.data);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <FileBarChart className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Add BRSR Core disclosure</h1>
            <p className="text-sm text-muted-foreground">
              Disclose the 9 BRSR Core ESG attributes for a financial year.
            </p>
          </div>
        </div>

        {period === null ? (
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
              This can&apos;t be changed once you start entering data for it.
            </p>
            <Button type="button" className="mt-4 w-full" onClick={handleContinue}>
              Continue
            </Button>
          </Card>
        ) : (
          <BrsrCoreForm facilityId={params.id} reportingPeriod={period} />
        )}
      </main>
    </div>
  );
}

export default function NewBrsrReportPage() {
  return (
    <ProtectedRoute>
      <NewBrsrReportContent />
    </ProtectedRoute>
  );
}
