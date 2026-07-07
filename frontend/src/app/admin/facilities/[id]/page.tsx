"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidencePendingBadge } from "@/components/ui/evidence-pending-badge";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { adminApi } from "@/lib/api";
import type { AdminFacilityDetail, ActivityData, EmissionCalculationResult } from "@/lib/types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ACTIVITY_DATA_FIELDS: { key: keyof ActivityData; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "periodStart", label: "Period Start" },
  { key: "periodEnd", label: "Period End" },
  { key: "productCategory", label: "Product Category" },
  { key: "productionQuantityT", label: "Production Quantity (t)" },
  { key: "gridElectricityMwh", label: "Grid Electricity (MWh)" },
  { key: "renewableElectricityMwh", label: "Renewable Electricity (MWh)" },
  { key: "gridEmissionFactorOverride", label: "Grid EF Override" },
  { key: "steamImportedGj", label: "Steam Imported (GJ)" },
  { key: "steamEmissionFactorOverride", label: "Steam EF Override" },
  { key: "limestoneInputTonnes", label: "Limestone Input (t)" },
  { key: "clinkerProducedTonnes", label: "Clinker Produced (t)" },
  { key: "clinkerConversionFraction", label: "Clinker Conversion Fraction" },
  { key: "cf4EmissionsTonnes", label: "CF4 Emissions (t)" },
  { key: "c2f6EmissionsTonnes", label: "C2F6 Emissions (t)" },
  { key: "anodeEffectMinutes", label: "Anode Effect (min)" },
  { key: "n2oProcessEmissionsTonnes", label: "N2O Process Emissions (t)" },
  { key: "n2oAbatementFactorPct", label: "N2O Abatement Factor (%)" },
  { key: "naturalGasFeedstockNm3", label: "Natural Gas Feedstock (Nm3)" },
  { key: "hydrogenRoute", label: "Hydrogen Route" },
  { key: "ccsCaptureRatePct", label: "CCS Capture Rate (%)" },
  { key: "hydrogenPurityPct", label: "Hydrogen Purity (%)" },
  { key: "byproductOxygenTonnes", label: "Byproduct Oxygen (t)" },
  { key: "electricityGeneratedMwh", label: "Electricity Generated (MWh)" },
  { key: "electricityExportedEuMwh", label: "Electricity Exported to EU (MWh)" },
  { key: "ownUseElectricityMwh", label: "Own-use Electricity (MWh)" },
  { key: "lineLossMwh", label: "Line Loss (MWh)" },
  { key: "carbonPricePaidEurPerTonne", label: "Carbon Price Paid (EUR/t)" },
  { key: "cctsTargetIntensity", label: "CCTS Target Intensity" },
  { key: "notes", label: "Notes" },
];

const CALC_RESULT_FIELDS: { key: keyof EmissionCalculationResult; label: string }[] = [
  { key: "directCombustionCo2eAr5", label: "Direct Combustion CO2e (AR5)" },
  { key: "directCombustionCo2eAr4", label: "Direct Combustion CO2e (AR2/BUR3)" },
  { key: "directProcessCo2e", label: "Direct Process CO2e" },
  { key: "directPrecursorCo2e", label: "Direct Precursor CO2e" },
  { key: "directPfcCo2eAr5", label: "Direct PFC CO2e (AR5)" },
  { key: "directPfcCo2eAr4", label: "Direct PFC CO2e (AR2/BUR3)" },
  { key: "directN2oProcessCo2eAr5", label: "Direct N2O Process CO2e (AR5)" },
  { key: "directN2oProcessCo2eAr4", label: "Direct N2O Process CO2e (AR2/BUR3)" },
  { key: "indirectElectricityCo2e", label: "Indirect Electricity CO2e" },
  { key: "indirectSteamCo2e", label: "Indirect Steam CO2e" },
  { key: "totalDirectCo2eAr5", label: "Total Direct CO2e (AR5)" },
  { key: "totalDirectCo2eAr4", label: "Total Direct CO2e (AR2/BUR3)" },
  { key: "totalEmissionsCbamAr5", label: "Total Emissions — CBAM (AR5)" },
  { key: "totalEmissionsCctsAr4", label: "Total Emissions — CCTS (AR2/BUR3)" },
  { key: "specificEmbeddedEmissionsCbam", label: "Specific Embedded Emissions (CBAM)" },
  { key: "ghgIntensityCcts", label: "GHG Intensity (CCTS)" },
  { key: "gridEmissionFactorUsed", label: "Grid EF Used" },
];

const formatFieldValue = (key: string, value: unknown): string => {
  if (value == null) return "—";
  if (key === "periodStart" || key === "periodEnd") return fmtDate(value as string);
  if (typeof value === "number") return value.toLocaleString("en-IN", { maximumFractionDigits: 4 });
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function AdminFacilityDetailContent() {
  const params = useParams<{ id: string }>();
  const [facility, setFacility] = useState<AdminFacilityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getFacility(params.id)
      .then(({ facility }) => setFacility(facility))
      .catch(() => setError("Couldn't load this facility."));
  }, [params.id]);

  const handleDownload = async (documentId: string, fileName: string) => {
    setDownloadingId(documentId);
    try {
      await adminApi.downloadDocument(documentId, fileName);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {facility && (
          <Link href={`/admin/companies/${facility.companyId}`} className="text-sm text-teal-500 hover:text-teal-400">
            Back to {facility.company.name}
          </Link>
        )}

        {error && <p className="mt-6 text-sm text-danger">{error}</p>}

        {!facility && !error && (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}

        {facility && (
          <>
            <h1 className="mt-4 text-2xl font-semibold">{facility.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {facility.company.name} · Owner: {facility.company.owner.email}
            </p>

            {/* Facility fields */}
            <Card className="mt-6 grid gap-5 p-6 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Facility ID" value={facility.id} />
              <Field label="Facility Type" value={facility.facilityType} />
              <Field label="Production Route" value={facility.productionRoute} />
              <Field label="Address" value={facility.address} />
              <Field label="State" value={facility.state} />
              <Field label="District" value={facility.district} />
              <Field label="Pincode" value={facility.pincode} />
              <Field label="Latitude" value={facility.latitude} />
              <Field label="Longitude" value={facility.longitude} />
              <Field label="Installed Capacity (tpa)" value={facility.installedCapacityTpa?.toLocaleString("en-IN")} />
              <Field label="Commissioning Year" value={facility.commissioningYear} />
              <Field label="Products Manufactured" value={facility.productsManufactured.join(", ") || "—"} />
              <Field label="CN Codes" value={facility.cnCodes.join(", ") || "—"} />
              <Field label="Draft" value={facility.isDraft ? "Yes" : "No"} />
              <Field label="Created" value={fmtDate(facility.createdAt)} />
              <Field label="Last Updated" value={fmtDate(facility.updatedAt)} />
            </Card>

            {/* Activity data */}
            <h2 className="mt-8 text-lg font-semibold">Activity Data Submissions</h2>
            {facility.activityData.length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">No activity data submitted yet.</Card>
            ) : (
              <div className="mt-4 space-y-4">
                {facility.activityData.map((entry) => (
                  <Card key={entry.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {entry.periodStart && entry.periodEnd ? `${fmtDate(entry.periodStart)} – ${fmtDate(entry.periodEnd)}` : "Draft entry"}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            entry.status === "SUBMITTED"
                              ? "rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500"
                              : "rounded-full border border-surface-border bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {entry.status}
                        </span>
                        {entry.evidencePending && <EvidencePendingBadge />}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted by {facility.company.owner.name} ({facility.company.owner.email}) · Last updated {fmtDateTime(entry.updatedAt)}
                    </p>
                    <div className="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3 lg:grid-cols-4">
                      {ACTIVITY_DATA_FIELDS.filter((f) => entry[f.key] != null).map((f) => (
                        <Field key={f.key} label={f.label} value={formatFieldValue(f.key, entry[f.key])} />
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Documents */}
            <h2 className="mt-8 text-lg font-semibold">Documents</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {facility.documents.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">File Name</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Reporting Period</th>
                      <th className="px-5 py-3 font-medium">Verified</th>
                      <th className="px-5 py-3 font-medium">Uploaded</th>
                      <th className="px-5 py-3 font-medium text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facility.documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 text-foreground">{doc.fileName}</td>
                        <td className="px-5 py-3 text-muted-foreground">{doc.documentType}</td>
                        <td className="px-5 py-3 text-muted-foreground">{doc.reportingPeriod}</td>
                        <td className="px-5 py-3 text-muted-foreground">{doc.verified ? "Yes" : "No"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDateTime(doc.createdAt)}</td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={downloadingId === doc.id}
                            onClick={() => handleDownload(doc.id, doc.fileName)}
                          >
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Reports */}
            <h2 className="mt-8 text-lg font-semibold">Reports Generated</h2>
            <Card className="mt-4 overflow-x-auto p-0">
              {facility.reports.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">No reports generated yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Period</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Generated At</th>
                      <th className="px-5 py-3 font-medium text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facility.reports.map((report) => (
                      <tr key={report.id} className="border-b border-surface-border last:border-b-0">
                        <td className="px-5 py-3 text-foreground">{report.reportType}</td>
                        <td className="px-5 py-3 text-muted-foreground">{report.period}</td>
                        <td className="px-5 py-3 text-muted-foreground">{report.status}</td>
                        <td className="px-5 py-3 text-muted-foreground">{fmtDateTime(report.generatedAt)}</td>
                        <td className="px-5 py-3 text-right">
                          {report.document && (
                            <Button
                              size="sm"
                              variant="secondary"
                              isLoading={downloadingId === report.document.id}
                              onClick={() => handleDownload(report.document!.id, `${report.reportType.toLowerCase()}-${report.period}.pdf`)}
                            >
                              Download
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Calculated emissions */}
            <h2 className="mt-8 text-lg font-semibold">Calculated Emissions</h2>
            {facility.activityData.filter((e) => e.calculationResult).length === 0 ? (
              <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">No calculated emissions yet.</Card>
            ) : (
              <div className="mt-4 space-y-4">
                {facility.activityData
                  .filter((e) => e.calculationResult)
                  .map((entry) => (
                    <Card key={entry.id} className="p-5">
                      <p className="text-sm font-medium text-foreground">
                        {entry.periodStart && entry.periodEnd ? `${fmtDate(entry.periodStart)} – ${fmtDate(entry.periodEnd)}` : entry.id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Calculated {fmtDateTime(entry.calculationResult!.calculatedAt)}</p>
                      <div className="mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3 lg:grid-cols-4">
                        {CALC_RESULT_FIELDS.map((f) => (
                          <Field key={f.key} label={f.label} value={formatFieldValue(f.key, entry.calculationResult![f.key])} />
                        ))}
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminFacilityDetailPage() {
  return (
    <SuperAdminRoute>
      <AdminFacilityDetailContent />
    </SuperAdminRoute>
  );
}
