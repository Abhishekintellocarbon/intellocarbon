/**
 * The Phase 2 ESG datasets, loaded once per report.
 *
 * Every one of these already existed and was already computed — but only for
 * the dashboard, by esgOverview.service. None of it reached a PDF. This module
 * exists so the reports read the *same builders* the dashboard reads rather
 * than growing their own second version of waste, energy or supplier logic,
 * which is how a report and a dashboard end up disagreeing about the same
 * company.
 *
 * Scope differs by dataset, and deliberately:
 *
 *   - Waste, energy mix and product footprint are facility-scoped, because
 *     that is the level the underlying disclosures are entered at and the
 *     level every report here is written at.
 *   - RECs, suppliers and targets are company-scoped, because that is where
 *     the data lives — a certificate is bought by a company, not a plant.
 *     Reports say so where they print them, rather than implying a facility
 *     figure.
 *
 * Everything returns an explicit empty state rather than throwing or omitting,
 * so a report for a company that has entered none of this renders normally
 * with honest "not reported" sections — which is the common case.
 */
import { prisma } from "../../config/prisma";
import { buildCircularityRollup, type CircularityRollup } from "../wasteCircularity.service";
import { buildEnergyMixTrend, type EnergyMixTrend } from "../energyMix.service";
import { buildRecCoverage, type RecCoverage } from "../recCoverage.service";
import { buildGovernanceSummary, type GovernanceSummary } from "../governanceSummary.service";
import { buildSupplierScorecard, type SupplierScorecard } from "../supplierScorecard.service";
import { buildNetZeroTrajectory, type NetZeroTrajectory } from "../netZeroTrajectory.service";
import { buildProductFootprint, type ProductFootprintAllocation } from "../productFootprint.service";
import { listCompanyTargets, type TargetProgress } from "../companyTarget.service";
import type { CompanyTarget } from "@prisma/client";

export interface ReportPhase2Data {
  circularity: CircularityRollup;
  energyMix: EnergyMixTrend;
  recCoverage: RecCoverage;
  governance: GovernanceSummary;
  suppliers: SupplierScorecard;
  targets: CompanyTarget[];
  targetProgress: TargetProgress[];
  trajectory: NetZeroTrajectory;
  productFootprint: ProductFootprintAllocation;
}

/**
 * Emissions the product footprint allocates over: this facility's Scope 1 + 2
 * for the period, on the AR5 basis every non-CCTS framework here uses.
 */
const facilityScope12ForPeriod = async (facilityId: string): Promise<number | null> => {
  const rows = await prisma.activityData.findMany({
    where: { facilityId, status: "SUBMITTED" },
    select: { calculationResult: { select: { totalEmissionsCbamAr5: true } } },
  });
  const values = rows.map((r) => r.calculationResult?.totalEmissionsCbamAr5).filter((v): v is number => v != null);
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) : null;
};

export const loadReportPhase2Data = async (
  companyId: string,
  facilityId: string,
  reportingPeriod: string,
): Promise<ReportPhase2Data> => {
  const [griRows, brsrRows, activityRows, recPurchases, supplierRows, skus, latestCsrd, latestCdp, targets] =
    await Promise.all([
      prisma.griReport.findMany({
        where: { facilityId, status: "SUBMITTED" },
        select: {
          reportingPeriod: true,
          wasteDisclosure: true,
          supplierEnvDisclosure: true,
          supplierSocialDisclosure: true,
          universalDisclosures: true,
        },
      }),
      prisma.brsrCoreReport.findMany({
        where: { facilityId, status: "SUBMITTED" },
        select: {
          reportingPeriod: true,
          wasteGeneratedTonnes: true,
          wasteRecoveredTonnes: true,
          renewableEnergyConsumptionGj: true,
          nonRenewableEnergyConsumptionGj: true,
        },
      }),
      prisma.activityData.findMany({
        where: { facilityId, status: "SUBMITTED" },
        select: {
          periodStart: true,
          gridElectricityMwh: true,
          renewableElectricityMwh: true,
          steamImportedGj: true,
        },
      }),
      // Company-scoped, and SUBMITTED only — a draft certificate is not a
      // claim, the same rule offsets follow.
      prisma.recPurchase.findMany({
        where: { companyId, status: "SUBMITTED" },
        select: { vintageYear: true, quantityMwh: true },
      }),
      prisma.supplier.findMany({ where: { companyId, status: "SUBMITTED" } }),
      prisma.productSku.findMany({ where: { facilityId, reportingPeriod, status: "SUBMITTED" } }),
      prisma.csrdReport.findFirst({
        where: { companyId, status: "SUBMITTED" },
        orderBy: { reportingPeriod: "desc" },
        select: { generalDisclosures: true, businessConductDisclosure: true },
      }),
      prisma.cdpReport.findFirst({
        where: { companyId, status: "SUBMITTED" },
        orderBy: { reportingPeriod: "desc" },
        select: { governance: true },
      }),
      listCompanyTargets(companyId, [facilityId]),
    ]);

  const latestGriUniversal =
    griRows
      .slice()
      .sort((a, b) => a.reportingPeriod.localeCompare(b.reportingPeriod))
      .at(-1)?.universalDisclosures ?? null;

  const facilityProduction = await prisma.activityData.aggregate({
    where: { facilityId, status: "SUBMITTED" },
    _sum: { productionQuantityT: true },
  });

  return {
    circularity: buildCircularityRollup(
      griRows
        .filter((r) => r.wasteDisclosure != null)
        .map((r) => ({ ...r.wasteDisclosure!, reportingPeriod: r.reportingPeriod })),
      brsrRows.map((r) => ({
        reportingPeriod: r.reportingPeriod,
        wasteGeneratedTonnes: r.wasteGeneratedTonnes,
        wasteRecoveredTonnes: r.wasteRecoveredTonnes,
      })),
    ),
    energyMix: buildEnergyMixTrend(
      brsrRows.map((r) => ({
        reportingPeriod: r.reportingPeriod,
        renewableEnergyConsumptionGj: r.renewableEnergyConsumptionGj,
        nonRenewableEnergyConsumptionGj: r.nonRenewableEnergyConsumptionGj,
      })),
      activityRows,
    ),
    recCoverage: buildRecCoverage(recPurchases, activityRows),
    governance: buildGovernanceSummary({
      gri: latestGriUniversal as Record<string, unknown> | null,
      esrs2: latestCsrd?.generalDisclosures as Record<string, unknown> | null,
      esrsG1: latestCsrd?.businessConductDisclosure as Record<string, unknown> | null,
      cdp: latestCdp?.governance as Record<string, unknown> | null,
    }),
    suppliers: buildSupplierScorecard(
      supplierRows,
      griRows.map((r) => ({
        reportingPeriod: r.reportingPeriod,
        env: r.supplierEnvDisclosure
          ? {
              newSuppliersScreenedPct: r.supplierEnvDisclosure.newSuppliersScreenedPct,
              suppliersAssessedCount: r.supplierEnvDisclosure.suppliersAssessedCount,
              suppliersWithNegativeImpactsCount: r.supplierEnvDisclosure.suppliersWithNegativeImpactsCount,
            }
          : null,
        social: r.supplierSocialDisclosure
          ? { newSuppliersScreenedPct: r.supplierSocialDisclosure.newSuppliersScreenedPct }
          : null,
      })),
    ),
    targets: targets.targets,
    targetProgress: targets.progress,
    trajectory: buildNetZeroTrajectory(targets.targets, targets.actuals),
    // A facility with no calculated emissions allocates zero across its SKUs,
    // which the allocator reports as such — the annex then prints an honest
    // nothing-to-allocate state rather than dividing by a missing figure.
    productFootprint: buildProductFootprint(
      reportingPeriod,
      (await facilityScope12ForPeriod(facilityId)) ?? 0,
      skus.map((s) => ({
        id: s.id,
        name: s.name,
        skuCode: s.skuCode,
        productionQuantity: s.productionQuantity,
        unit: s.unit,
      })),
      facilityProduction._sum.productionQuantityT,
    ),
  };
};
