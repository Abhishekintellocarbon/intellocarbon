"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FacilityForm } from "@/components/facilities/facility-form";
import { facilityApi } from "@/lib/api";
import type { Facility } from "@/lib/types";

function EditFacilityContent() {
  const params = useParams<{ id: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    facilityApi
      .get(params.id)
      .then(({ facility }) => setFacility(facility))
      .catch(() => setError("Couldn't load this facility. It may not exist or you may not have access."));
  }, [params.id]);

  if (error) {
    return <p className="mx-auto max-w-2xl text-sm text-danger">{error}</p>;
  }

  if (!facility) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  return <FacilityForm facility={facility} />;
}

export default function EditFacilityPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background px-4 py-12 sm:py-16">
        <Suspense fallback={null}>
          <EditFacilityContent />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
