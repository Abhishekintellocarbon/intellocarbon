"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Globe2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { csrdReportingPeriodSchema } from "@/lib/validations/csrd";

// e.g. in Jul 2026, suggests "FY2026-27" — a starting point only; the user can edit it.
const suggestedFy = (): string => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${String((year + 1) % 100).padStart(2, "0")}`;
};

function NewCsrdReportContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [draftPeriod, setDraftPeriod] = useState(suggestedFy());
  const [periodError, setPeriodError] = useState<string | null>(null);

  const handleContinue = () => {
    const result = csrdReportingPeriodSchema.safeParse(draftPeriod);
    if (!result.success) {
      setPeriodError(result.error.issues[0]?.message ?? "Enter a valid reporting period");
      return;
    }
    setPeriodError(null);
    // Straight to materiality, not to the disclosure form. CSRD 3 is the
    // mandatory starting point — the backend refuses disclosure data until the
    // assessment is complete, so sending the user anywhere else first would
    // dead-end them.
    router.push(`/facilities/${params.id}/csrd/${encodeURIComponent(result.data)}/materiality`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-teal-blue">
            <Globe2 className="h-5 w-5 text-[#06120F]" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Start a CSRD sustainability statement</h1>
            <p className="text-sm text-muted-foreground">
              Full ESRS — general disclosures, a double materiality assessment, and the topical standards it determines apply.
            </p>
          </div>
        </div>

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
            You&apos;ll start with the double materiality assessment, which determines which ESRS standards you report.
          </p>
          <Button type="button" className="mt-4 w-full" onClick={handleContinue}>
            Continue
          </Button>
        </Card>
      </main>
    </div>
  );
}

export default function NewCsrdReportPage() {
  return (
    <ProtectedRoute>
      <NewCsrdReportContent />
    </ProtectedRoute>
  );
}
