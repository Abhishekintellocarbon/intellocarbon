import type { Metadata } from "next";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CompanyWizard } from "@/components/onboarding/company-wizard";

export const metadata: Metadata = { title: "Set up your company — Intellocarbon" };

export default function CompanyOnboardingPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background px-4 py-12 sm:py-16">
        <CompanyWizard />
      </div>
    </ProtectedRoute>
  );
}
