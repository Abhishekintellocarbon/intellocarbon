import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FacilityForm } from "@/components/facilities/facility-form";

export const metadata: Metadata = { title: "Add a facility — Intellocarbon" };

export default function NewFacilityPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background px-4 py-12 sm:py-16">
        <Suspense fallback={null}>
          <FacilityForm />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
