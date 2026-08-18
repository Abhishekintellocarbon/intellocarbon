"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppHeader } from "@/components/layout/app-header";
import { TargetManager } from "@/components/esg/target-manager";
import { RecManager } from "@/components/esg/rec-manager";
import { SupplierManager } from "@/components/esg/supplier-manager";

/**
 * Entry for the company-level ESG records that feed the overview dashboard —
 * reduction targets, renewable certificates and key suppliers.
 *
 * One page rather than three near-identical ones: all three are short lists a
 * company maintains occasionally, and splitting them would mean three routes
 * to find and three sets of navigation for what is one housekeeping task.
 * Per-facility records (product SKUs) stay on the facility page, where the
 * facility and period they belong to are already established.
 */
function EsgDataContent() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/esg/overview"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-teal-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to ESG Overview
        </Link>

        <h1 className="text-xl font-semibold">ESG data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company-level records that feed the overview dashboard. Everything here is your own record — nothing is
          verified, rated or submitted anywhere by us.
        </p>

        <div className="mt-8 space-y-6">
          <TargetManager />
          <RecManager />
          <SupplierManager />
        </div>
      </main>
    </div>
  );
}

export default function EsgDataPage() {
  return (
    <ProtectedRoute>
      <EsgDataContent />
    </ProtectedRoute>
  );
}
