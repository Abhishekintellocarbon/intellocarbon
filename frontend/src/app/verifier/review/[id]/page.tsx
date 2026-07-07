"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, Loader2, MessageSquareWarning } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { VerifierRoute } from "@/components/auth/verifier-route";
import { AppHeader } from "@/components/layout/app-header";
import { verifierApi, ApiError } from "@/lib/api";
import type { AnnexVIChecklistItem, VerificationQuery, VerificationRequestDetail } from "@/lib/types";

const fmt = (n: number, digits = 3) => n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface DecisionForm {
  verifierOrg: string;
  accreditationNumber: string;
  statement: string;
  qualifications: string;
  comments: string;
}

function ChecklistSection({
  requestId,
  items,
  checklistState,
  onChange,
  readOnly,
}: {
  requestId: string;
  items: AnnexVIChecklistItem[];
  checklistState: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
  readOnly: boolean;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggle = async (itemId: string, checked: boolean) => {
    const next = { ...checklistState, [itemId]: checked };
    onChange(next);
    setSavingId(itemId);
    try {
      await verifierApi.updateChecklist(requestId, { [itemId]: checked });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-medium">Annex VI verification checklist</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every item must be ticked before a verification statement can be issued.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 rounded-lg border border-surface-border p-3 text-sm">
            <input
              type="checkbox"
              checked={checklistState[item.id] === true}
              onChange={(e) => toggle(item.id, e.target.checked)}
              disabled={readOnly || savingId === item.id}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-surface-border accent-teal-500"
            />
            <span>
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

function QueriesSection({
  requestId,
  queries,
  canRaise,
  onRaised,
}: {
  requestId: string;
  queries: VerificationQuery[];
  canRaise: boolean;
  onRaised: (query: VerificationQuery) => void;
}) {
  const [queryText, setQueryText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRaise = async () => {
    if (!queryText.trim()) return;
    setError(null);
    setIsSending(true);
    try {
      const { query } = await verifierApi.raiseQuery(requestId, queryText.trim());
      onRaised(query);
      setQueryText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't raise this query.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="font-medium">Queries</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Raise a query if anything looks wrong — the company admin is notified by email and must resolve every open query before this request can be approved.
      </p>

      {queries.length > 0 && (
        <div className="mt-4 space-y-3">
          {queries.map((q) => (
            <div key={q.id} className="rounded-lg border border-surface-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    q.status === "OPEN"
                      ? "rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                      : "rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500"
                  }
                >
                  {q.status}
                </span>
                <span className="text-xs text-muted">{formatDateTime(q.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-foreground/90">{q.queryText}</p>
              {q.responseText && (
                <div className="mt-2 rounded-lg bg-surface-raised/60 p-2.5">
                  <p className="text-xs font-medium text-muted-foreground">Company response</p>
                  <p className="mt-0.5 text-sm text-foreground/90">{q.responseText}</p>
                  {q.respondedAt && <p className="mt-1 text-xs text-muted">{formatDateTime(q.respondedAt)}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canRaise && (
        <div className="mt-4 border-t border-surface-border pt-4">
          {error && (
            <div className="mb-3">
              <Alert variant="error">{error}</Alert>
            </div>
          )}
          <Label htmlFor="query-text">Raise a new query</Label>
          <textarea
            id="query-text"
            rows={3}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
            placeholder="e.g. The fuel quantity in the March entry doesn't match the uploaded invoice — please clarify."
          />
          <Button size="sm" className="mt-2" onClick={handleRaise} isLoading={isSending} disabled={!queryText.trim()}>
            <MessageSquareWarning className="h-3.5 w-3.5" />
            Raise query
          </Button>
        </div>
      )}
    </Card>
  );
}

function ReviewContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<VerificationRequestDetail | null>(null);
  const [checklistItems, setChecklistItems] = useState<AnnexVIChecklistItem[]>([]);
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [queries, setQueries] = useState<VerificationQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"APPROVED" | "REJECTED" | null>(null);

  const { register, getValues } = useForm<DecisionForm>({
    defaultValues: { verifierOrg: "", accreditationNumber: "", statement: "", qualifications: "", comments: "" },
  });

  useEffect(() => {
    verifierApi
      .get(params.id)
      .then(({ request }) => {
        setRequest(request);
        setChecklistState(request.checklistState ?? {});
      })
      .catch(() => setError("Couldn't load this verification request."));
    verifierApi.getChecklistItems().then(({ items }) => setChecklistItems(items));
    verifierApi.listQueries(params.id).then(({ queries }) => setQueries(queries));
  }, [params.id]);

  const handleDecide = async (status: "APPROVED" | "REJECTED") => {
    setError(null);
    setDeciding(status);
    try {
      const values = getValues();
      await verifierApi.decide(params.id, {
        status,
        verifierOrg: values.verifierOrg || undefined,
        accreditationNumber: values.accreditationNumber || undefined,
        statement: values.statement || undefined,
        qualifications: values.qualifications || undefined,
        comments: values.comments || undefined,
      });
      router.push("/verifier/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your decision.");
      setDeciding(null);
    }
  };

  if (error && !request) return <p className="text-sm text-danger">{error}</p>;
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

  const allChecklistComplete = checklistItems.length > 0 && checklistItems.every((item) => checklistState[item.id] === true);
  const openQueryCount = queries.filter((q) => q.status === "OPEN").length;
  const canApprove = allChecklistComplete && openQueryCount === 0;

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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{facility.company.name}</h1>
          {activityData.evidencePending && <EvidencePendingBadge />}
        </div>
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
            <dd className="mt-0.5">{facility.facilityType?.replace(/_/g, " ") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Production route</dt>
            <dd className="mt-0.5">{facility.productionRoute?.replace(/_/g, " ") ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sector</dt>
            <dd className="mt-0.5">{facility.company.sector}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Production quantity</dt>
            <dd className="mt-0.5">{(activityData.productionQuantityT ?? 0).toLocaleString("en-IN")} t</dd>
          </div>
        </dl>
        <Link href={`/verifier/facilities/${facility.id}`} className="mt-4 inline-block text-xs font-medium text-teal-500 hover:text-teal-400">
          View full facility detail, documents, and calculation breakdown →
        </Link>
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
            <p className="text-xs text-muted-foreground">tCO2e / t product (GHG intensity, AR2/BUR3 GWP)</p>
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

      {canDecide && (
        <ChecklistSection
          requestId={params.id}
          items={checklistItems}
          checklistState={checklistState}
          onChange={setChecklistState}
          readOnly={!canDecide}
        />
      )}

      <QueriesSection
        requestId={params.id}
        queries={queries}
        canRaise={canDecide}
        onRaised={(query) => setQueries((prev) => [query, ...prev])}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {canDecide ? (
        <Card className="p-6">
          <h2 className="font-medium">Issue verification statement</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="verifierOrg">
                Your organization <span className="text-muted">(optional)</span>
              </Label>
              <Input id="verifierOrg" placeholder="e.g. TÜV SÜD India" {...register("verifierOrg")} />
            </div>
            <div>
              <Label htmlFor="accreditationNumber">
                Accreditation number <span className="text-muted">(optional)</span>
              </Label>
              <Input id="accreditationNumber" placeholder="e.g. TSI-ACC-2024-0198" {...register("accreditationNumber")} />
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
              <Label htmlFor="qualifications">
                Qualifications or emphasis of matter <span className="text-muted">(optional)</span>
              </Label>
              <textarea
                id="qualifications"
                rows={2}
                className="w-full rounded-xl border border-surface-border bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20"
                placeholder="Any caveats or matters the declarant should be aware of, without qualifying the overall opinion"
                {...register("qualifications")}
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

            {!canApprove && (
              <Alert variant="info">
                {!allChecklistComplete && "Tick every Annex VI checklist item"}
                {!allChecklistComplete && openQueryCount > 0 && " and "}
                {openQueryCount > 0 && `resolve ${openQueryCount} open ${openQueryCount === 1 ? "query" : "queries"}`}
                {" "}before you can approve and issue the verification statement. You can still reject this request.
              </Alert>
            )}

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
                disabled={deciding !== null || !canApprove}
                title={!canApprove ? "Complete the checklist and resolve all open queries first" : undefined}
              >
                <Check className="h-3.5 w-3.5" />
                Approve & issue statement
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Alert variant={request.status === "APPROVED" ? "success" : "info"}>
          This request was {request.status.toLowerCase().replace(/_/g, " ")}
          {request.decidedAt ? ` on ${formatDate(request.decidedAt)}` : ""}.
          {request.statement && ` "${request.statement}"`}
          {request.qualifications && ` Qualifications: "${request.qualifications}"`}
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
