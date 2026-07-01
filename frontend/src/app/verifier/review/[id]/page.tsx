"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { VerifierRoute } from "@/components/auth/verifier-route";
import { AppHeader } from "@/components/layout/app-header";
import { verifierApi, ApiError } from "@/lib/api";
import type { VerificationRequestDetail } from "@/lib/types";

const fmt = (n: number, digits = 3) => n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

interface DecisionForm {
  verifierOrg: string;
  statement: string;
  comments: string;
}

function ReviewContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<VerificationRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(null);

  const { register, getValues } = useForm<DecisionForm>({
    defaultValues: { verifierOrg: "", statement: "", comments: "" },
  });

  useEffect(() => {
    verifierApi
      .get(params.id)
      .then(({ request }) => setRequest(request))
      .catch(() => setError("Couldn't load this verification request."));
  }, [params.id]);

  const handleDecide = async (status: "APPROVED" | "REJECTED") => {
    setError(null);
    setDeciding(status);
    try {
      const values = getValues();
      await verifierApi.decide(params.id, {
        status,
        verifierOrg: values.verifierOrg || undefined,
        statement: values.statement || undefined,
        comments: values.comments || undefined,
      });
      router.push("/verifier/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your decision.");
      setDeciding(null);
    }
  };

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!request) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
      </div>
    );
  }

  const { activityData } = request;
  const { facility } = activityData;
  const result = activityData.calculationResult;
  const canDecide = request.status === "IN_REVIEW";

  return (
    <div className="space-y-6">
      <Link
        href="/verifier/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{facility.company.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {facility.name} · {activityData.productCategory} · {formatDate(activityData.periodStart)} –{" "}
          {formatDate(activityData.periodEnd)}
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-medium">Facility</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="mt-0.5">{facility.facilityType.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Production route</dt>
            <dd className="mt-0.5">{facility.productionRoute.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sector</dt>
            <dd className="mt-0.5">{facility.company.sector}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Production quantity</dt>
            <dd className="mt-0.5">{activityData.productionQuantityT.toLocaleString("en-IN")} t</dd>
          </div>
        </dl>
      </Card>

      {result && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-6">
            <span className="rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-semibold text-teal-500">CBAM</span>
            <p className="mt-3 text-2xl font-semibold">{fmt(result.specificEmbeddedEmissionsCbam)}</p>
            <p className="text-xs text-muted-foreground">tCO2e / t product (SEE, AR5 GWP)</p>
          </Card>
          <Card className="p-6">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">CCTS</span>
            <p className="mt-3 text-2xl font-semibold">{fmt(result.ghgIntensityCcts)}</p>
            <p className="text-xs text-muted-foreground">tCO2e / t product (GHG intensity, AR4 GWP)</p>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h2 className="font-medium">Activity data submitted</h2>
        <div className="mt-4 space-y-4 text-sm">
          {activityData.fuelEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Fuels</p>
              <ul className="mt-1.5 space-y-1">
                {activityData.fuelEntries.map((f) => (
                  <li key={f.id} className="text-foreground/90">
                    {f.fuelType.replace(/_/g, " ")} — {f.quantity.toLocaleString("en-IN")} {f.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activityData.processMaterialEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Process materials</p>
              <ul className="mt-1.5 space-y-1">
                {activityData.processMaterialEntries.map((m) => (
                  <li key={m.id} className="text-foreground/90">
                    {m.materialType.replace(/_/g, " ")} — {m.quantityTonnes.toLocaleString("en-IN")} t
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activityData.precursorEntries.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Precursor materials</p>
              <ul className="mt-1.5 space-y-1">
                {activityData.precursorEntries.map((p) => (
                  <li key={p.id} className="text-foreground/90">
                    {p.materialType.replace(/_/g, " ")} — {p.quantityTonnes.toLocaleString("en-IN")} t
                    {p.sourceLabel ? ` (${p.sourceLabel})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Electricity & steam</p>
            <p className="mt-1.5 text-foreground/90">
              {activityData.gridElectricityMwh.toLocaleString("en-IN")} MWh grid,{" "}
              {activityData.renewableElectricityMwh.toLocaleString("en-IN")} MWh renewable,{" "}
              {activityData.steamImportedGj.toLocaleString("en-IN")} GJ steam
            </p>
          </div>
          {activityData.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes from submitter</p>
              <p className="mt-1.5 text-foreground/90">{activityData.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {canDecide ? (
        <Card className="p-6">
          <h2 className="font-medium">Your decision</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="verifierOrg">
                Your organization <span className="text-muted">(optional)</span>
              </Label>
              <Input id="verifierOrg" placeholder="e.g. TÜV SÜD India" {...register("verifierOrg")} />
            </div>
            <div>
              <Label htmlFor="statement">
                Verification statement <span className="text-muted">(shown on approval, optional)</span>
              </Label>
              <textarea
                id="statement"
                rows={3}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
                placeholder="We have reviewed the submitted activity data and confirm the reported emissions are reasonable and consistent with supporting evidence."
                {...register("statement")}
              />
            </div>
            <div>
              <Label htmlFor="comments">
                Comments <span className="text-muted">(shown on rejection, optional)</span>
              </Label>
              <textarea
                id="comments"
                rows={3}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
                placeholder="What needs to be corrected before this can be approved"
                {...register("comments")}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={() => handleDecide("REJECTED")}
                isLoading={deciding === "REJECTED"}
                disabled={deciding !== null}
              >
                Reject
              </Button>
              <Button
                onClick={() => handleDecide("APPROVED")}
                isLoading={deciding === "APPROVED"}
                disabled={deciding !== null}
              >
                Approve
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Alert variant={request.status === "APPROVED" ? "success" : "info"}>
          This request was {request.status.toLowerCase().replace(/_/g, " ")}
          {request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""}.
          {request.statement && ` "${request.statement}"`}
          {request.comments && ` "${request.comments}"`}
        </Alert>
      )}
    </div>
  );
}

export default function VerifierReviewPage() {
  return (
    <VerifierRoute>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <ReviewContent />
        </main>
      </div>
    </VerifierRoute>
  );
}
