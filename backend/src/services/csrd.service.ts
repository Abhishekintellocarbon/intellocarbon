import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacilityForEsgBundle, throwEsgBundleAccessDenied } from "./esgBundleAccess.service";
import { isGriReportWindowOpen, griUnlockDate } from "../data/complianceDeadlines";
import { ESRS_STANDARDS, getEsrsStandard } from "../data/esrsStandards";
import {
  buildCsrdMetrics,
  computeImpactScore,
  computeFinancialScore,
  rankStandardsByIros,
  standardLabel,
  CSRD_REPORT_INCLUDE,
  type CsrdReportWithRelations,
} from "./csrdCalculation.service";
import { buildDisclosureIndex } from "./csrdDisclosureIndex.service";
import {
  parseGeneralPayload,
  parseStandardPayload,
  type CsrdDataInput,
  type CsrdMaterialityInput,
} from "../validators/csrd.validators";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/**
 * CSRD reports open on the same annual cycle as every other framework here, so
 * the window helper is shared rather than duplicated. Named locally so the two
 * can diverge if CSRD's filing calendar ever separates from the FY cycle —
 * which it plausibly will, since ESRS statements accompany the management
 * report rather than a standalone filing.
 */
const requireCsrdReportWindowOpen = (reportingPeriod: string, now: Date = new Date()): void => {
  if (!isGriReportWindowOpen(reportingPeriod, now)) {
    throw AppError.forbidden(
      `Report generation for ${reportingPeriod} opens on ${fmtUnlockDate(griUnlockDate(reportingPeriod))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
};

const requireDraft = (report: { status: string } | null, allow: boolean): void => {
  if (report && report.status === "SUBMITTED" && !allow) {
    throw AppError.badRequest(
      "This CSRD statement has already been submitted — resubmit explicitly to edit it",
      "CSRD_REPORT_NOT_DRAFT",
    );
  }
};

const upsertReportShell = async (companyId: string, facilityId: string, reportingPeriod: string) =>
  prisma.csrdReport.upsert({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    create: { companyId, facilityId, reportingPeriod },
    update: {},
  });

export const listCsrdReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);
  return prisma.csrdReport.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "desc" },
    include: {
      materialityAssessment: { select: { completedAt: true, impactThreshold: true, financialThreshold: true } },
      materialTopics: { select: { standardCode: true, isMaterial: true, impactMaterial: true, financialMaterial: true } },
    },
  });
};

// ---------------------------------------------------------------------------
// Double materiality assessment
// ---------------------------------------------------------------------------

/**
 * Saves the assessment and, as its real output, recomputes which ESRS standards
 * are material.
 *
 * Both axes are scored server-side and the determination is derived here, not
 * accepted from the client — the same rule as GRI, for the same reason: it is
 * the gate on what may be written afterwards.
 *
 * As with GRI, an explicit completed re-run is accepted on a submitted
 * statement (a preparer who spots a mis-scored IRO must be able to correct it)
 * while a background autosave is not, and a re-run that moves the material set
 * drops the statement back to DRAFT so it must be resubmitted.
 */
export const saveMaterialityAssessment = async (
  userId: string,
  facilityId: string,
  input: CsrdMaterialityInput,
) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const existingReport = await prisma.csrdReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
  });
  requireDraft(existingReport, input.complete === true);

  const report = await upsertReportShell(facility.companyId, facilityId, input.reportingPeriod);

  const impactThreshold = input.impactThreshold ?? 3;
  const financialThreshold = input.financialThreshold ?? 3;

  const scoredIros = (input.iros ?? []).map((iro) => {
    const onImpact = iro.kind !== "FINANCIAL";
    const onFinancial = iro.kind !== "IMPACT";
    return {
      standardCode: iro.standardCode,
      description: iro.description,
      kind: iro.kind,
      valueChainLocation: iro.valueChainLocation,
      impactType: onImpact ? (iro.impactType ?? null) : null,
      scale: onImpact ? (iro.scale ?? null) : null,
      scope: onImpact ? (iro.scope ?? null) : null,
      irremediability: onImpact ? (iro.irremediability ?? null) : null,
      impactLikelihood: onImpact ? (iro.impactLikelihood ?? null) : null,
      impactScore:
        onImpact && iro.impactType && iro.scale != null && iro.scope != null
          ? computeImpactScore({
              impactType: iro.impactType,
              scale: iro.scale,
              scope: iro.scope,
              irremediability: iro.irremediability,
              likelihood: iro.impactLikelihood,
            })
          : null,
      financialEffectType: onFinancial ? (iro.financialEffectType ?? null) : null,
      magnitude: onFinancial ? (iro.magnitude ?? null) : null,
      financialLikelihood: onFinancial ? (iro.financialLikelihood ?? null) : null,
      financialScore:
        onFinancial && iro.magnitude != null
          ? computeFinancialScore({ magnitude: iro.magnitude, likelihood: iro.financialLikelihood })
          : null,
    };
  });

  const assessmentData = {
    stakeholderGroups: input.stakeholderGroups ?? [],
    engagementApproach: input.engagementApproach || null,
    iroIdentificationProcess: input.iroIdentificationProcess || null,
    prioritisationProcess: input.prioritisationProcess || null,
    impactThreshold,
    financialThreshold,
    completedAt: input.complete ? new Date() : null,
  };

  const assessment = await prisma.$transaction(async (tx) => {
    const saved = await tx.csrdMaterialityAssessment.upsert({
      where: { csrdReportId: report.id },
      create: { csrdReportId: report.id, ...assessmentData },
      update: assessmentData,
    });
    // Full replace — the client always sends the complete list, and diffing
    // would leave orphans when a row is removed.
    await tx.csrdIro.deleteMany({ where: { assessmentId: saved.id } });
    if (scoredIros.length > 0) {
      await tx.csrdIro.createMany({ data: scoredIros.map((i) => ({ ...i, assessmentId: saved.id })) });
    }
    return saved;
  });

  const scores = rankStandardsByIros(scoredIros, impactThreshold, financialThreshold);
  const scoreByStandard = new Map(scores.map((s) => [s.standardCode, s]));

  const existingTopics = new Map(
    (await prisma.csrdMaterialTopic.findMany({ where: { csrdReportId: report.id } })).map((t) => [t.standardCode, t]),
  );

  const autoRationale = (score: (typeof scores)[number] | undefined): string => {
    if (!score) {
      return "No impacts, risks or opportunities were identified for this standard during the double materiality assessment.";
    }
    const parts: string[] = [];
    if (score.impactScore != null) parts.push(`impact materiality ${score.impactScore.toFixed(2)}`);
    if (score.financialScore != null) parts.push(`financial materiality ${score.financialScore.toFixed(2)}`);
    return `Assessed at ${parts.join(" and ")}, below the disclosed threshold on both axes (impact ${impactThreshold.toFixed(2)}, financial ${financialThreshold.toFixed(2)}).`;
  };

  for (const standard of ESRS_STANDARDS) {
    const score = scoreByStandard.get(standard.code);
    const isMaterial = score?.isMaterial ?? false;
    const existing = existingTopics.get(standard.code);

    // Same rule as GRI: regenerate the auto rationale whenever the
    // determination moved, preserve it when it genuinely has not, since the
    // stored text may have been rewritten by the preparer.
    const determinationUnchanged =
      existing != null &&
      existing.isMaterial === false &&
      existing.impactScore === (score?.impactScore ?? null) &&
      existing.financialScore === (score?.financialScore ?? null);

    const notMaterialRationale = isMaterial
      ? null
      : determinationUnchanged && existing?.notMaterialRationale
        ? existing.notMaterialRationale
        : autoRationale(score);

    const data = {
      isMaterial,
      impactMaterial: score?.impactMaterial ?? false,
      financialMaterial: score?.financialMaterial ?? false,
      impactScore: score?.impactScore ?? null,
      financialScore: score?.financialScore ?? null,
      notMaterialRationale,
    };

    await prisma.csrdMaterialTopic.upsert({
      where: { csrdReportId_standardCode: { csrdReportId: report.id, standardCode: standard.code } },
      create: { csrdReportId: report.id, standardCode: standard.code, ...data },
      update: data,
    });
  }

  const materialSetChanged = ESRS_STANDARDS.some((standard) => {
    const before = existingTopics.get(standard.code)?.isMaterial ?? false;
    const after = scoreByStandard.get(standard.code)?.isMaterial ?? false;
    return before !== after;
  });

  if (materialSetChanged && existingReport?.status === "SUBMITTED") {
    await prisma.csrdReport.update({ where: { id: report.id }, data: { status: "DRAFT" } });
  }

  return { assessment, scores, materialSetChanged };
};

export const getMaterialityAssessment = async (userId: string, facilityId: string, reportingPeriod: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.csrdReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: {
      materialityAssessment: { include: { iros: true } },
      materialTopics: { orderBy: [{ isMaterial: "desc" }, { standardCode: "asc" }] },
    },
  });

  if (!report) return { report: null, assessment: null, materialTopics: [], scores: [] };

  return {
    report: { id: report.id, reportingPeriod: report.reportingPeriod, status: report.status },
    assessment: report.materialityAssessment,
    materialTopics: report.materialTopics,
    scores: rankStandardsByIros(
      report.materialityAssessment?.iros ?? [],
      report.materialityAssessment?.impactThreshold ?? 3,
      report.materialityAssessment?.financialThreshold ?? 3,
    ),
  };
};

// ---------------------------------------------------------------------------
// Datapoint entry
// ---------------------------------------------------------------------------

const standardDelegate = (relation: string) => {
  const delegates: Record<string, { upsert: (args: unknown) => Promise<unknown> }> = {
    climateDisclosure: prisma.csrdClimateDisclosure as never,
    pollutionDisclosure: prisma.csrdPollutionDisclosure as never,
    waterDisclosure: prisma.csrdWaterDisclosure as never,
    biodiversityDisclosure: prisma.csrdBiodiversityDisclosure as never,
    circularDisclosure: prisma.csrdCircularDisclosure as never,
    ownWorkforceDisclosure: prisma.csrdOwnWorkforceDisclosure as never,
    valueChainWorkersDisclosure: prisma.csrdValueChainWorkersDisclosure as never,
    communitiesDisclosure: prisma.csrdCommunitiesDisclosure as never,
    consumersDisclosure: prisma.csrdConsumersDisclosure as never,
    businessConductDisclosure: prisma.csrdBusinessConductDisclosure as never,
  };
  return delegates[relation];
};

const normalise = (value: unknown): unknown => (value === "" || value === undefined ? null : value);

const normaliseRow = (payload: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, normalise(v)]));

/**
 * Saves ESRS 2 general disclosures, per-standard minimum disclosure
 * requirements, and datapoints for material standards.
 *
 * Materiality gating is enforced here, not merely reflected in the UI: writing
 * datapoints for a standard the assessment judged immaterial is rejected.
 * Without that, a stale form could reintroduce data for an excluded standard
 * and the disclosure index would contradict the statement body.
 */
export const saveCsrdData = async (userId: string, facilityId: string, input: CsrdDataInput, submit: boolean) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const existing = await prisma.csrdReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
    include: { materialTopics: true, materialityAssessment: { select: { completedAt: true } } },
  });
  requireDraft(existing, submit);

  if (!existing?.materialityAssessment?.completedAt) {
    throw AppError.badRequest(
      "Complete the double materiality assessment before entering datapoints — it determines which ESRS standards apply",
      "CSRD_MATERIALITY_INCOMPLETE",
    );
  }

  const report = await upsertReportShell(facility.companyId, facilityId, input.reportingPeriod);
  const materialByCode = new Map(existing.materialTopics.map((t) => [t.standardCode, t.isMaterial]));

  await prisma.csrdReport.update({
    where: { id: report.id },
    data: {
      netRevenueEur: normalise(input.netRevenueEur) as number | null,
      notes: (normalise(input.notes) as string | null) ?? null,
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  });

  if (input.general) {
    const parsed = parseGeneralPayload(input.general, submit);
    if (!parsed.success) throw AppError.badRequest(parsed.message, "VALIDATION_ERROR");
    const data = normaliseRow(parsed.data);
    await prisma.csrdGeneralDisclosures.upsert({
      where: { csrdReportId: report.id },
      create: { csrdReportId: report.id, ...data },
      update: data,
    });
  }

  // isMaterial is NOT writable here — it is an output of the assessment, and
  // letting the datapoint form flip it would bypass the assessment entirely.
  for (const topic of input.materialTopics ?? []) {
    if (!getEsrsStandard(topic.standardCode)) {
      throw AppError.badRequest(`Unknown ESRS standard "${topic.standardCode}"`, "CSRD_UNKNOWN_STANDARD");
    }
    await prisma.csrdMaterialTopic.update({
      where: { csrdReportId_standardCode: { csrdReportId: report.id, standardCode: topic.standardCode } },
      data: {
        policies: normalise(topic.policies) as string | null,
        actions: normalise(topic.actions) as string | null,
        targets: normalise(topic.targets) as string | null,
        metrics: normalise(topic.metrics) as string | null,
        ...(materialByCode.get(topic.standardCode) === false
          ? { notMaterialRationale: normalise(topic.notMaterialRationale) as string | null }
          : {}),
      },
    });
  }

  for (const [standardCode, payload] of Object.entries(input.standards ?? {})) {
    const standard = getEsrsStandard(standardCode);
    if (!standard) {
      throw AppError.badRequest(`Unknown ESRS standard "${standardCode}"`, "CSRD_UNKNOWN_STANDARD");
    }
    if (materialByCode.get(standardCode) !== true) {
      throw AppError.badRequest(
        `${standardLabel(standardCode)} was not assessed as material for this facility — re-run the double materiality assessment before disclosing it`,
        "CSRD_STANDARD_NOT_MATERIAL",
      );
    }

    const parsed = parseStandardPayload(standardCode, payload, submit);
    if (!parsed.success) throw AppError.badRequest(parsed.message, "VALIDATION_ERROR");

    const data = normaliseRow(parsed.data);
    await standardDelegate(standard.relation).upsert({
      where: { csrdReportId: report.id },
      create: { csrdReportId: report.id, ...data },
      update: data,
    });
  }

  if (submit) {
    const full = await loadReport(report.id);
    const metrics = await buildCsrdMetrics(full, facility, facility.company);
    const empty = metrics.conformity.standards.filter((s) => s.isMaterial && !s.hasAnyData);
    if (empty.length > 0) {
      throw AppError.badRequest(
        `These standards are material but have no datapoints reported: ${empty.map((s) => `${s.label} ${s.title}`).join(", ")}`,
        "CSRD_STANDARD_EMPTY",
      );
    }
  }

  return loadReport(report.id);
};

const loadReport = async (id: string): Promise<CsrdReportWithRelations> => {
  const report = await prisma.csrdReport.findUnique({ where: { id }, include: CSRD_REPORT_INCLUDE });
  if (!report) throw AppError.notFound("CSRD statement not found");
  return report;
};

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export const getCsrdDraft = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);
  const report = await prisma.csrdReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: CSRD_REPORT_INCLUDE,
  });
  if (!report) return { report: null, metrics: null };
  return { report, metrics: await buildCsrdMetrics(report, facility, facility.company) };
};

export const getCsrdReportData = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.csrdReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: CSRD_REPORT_INCLUDE,
  });
  if (!report) throw AppError.notFound("CSRD statement not found for this facility and reporting period");
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this CSRD statement before generating it", "CSRD_REPORT_NOT_SUBMITTED");
  }
  requireCsrdReportWindowOpen(reportingPeriod);

  const metrics = await buildCsrdMetrics(report, facility, facility.company);
  return { report, facility, metrics, disclosureIndex: buildDisclosureIndex(report, metrics) };
};

export const getCsrdReportContextById = async (userId: string, reportId: string) => {
  const report = await prisma.csrdReport.findUnique({
    where: { id: reportId },
    include: {
      ...CSRD_REPORT_INCLUDE,
      facility: {
        include: {
          company: {
            include: {
              owner: true,
              subscriptions: { where: { status: "ACTIVE", tier: "BRSR_CORE_REPORTING" }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!report || report.facility.company.ownerId !== userId) {
    throw AppError.notFound("CSRD statement not found");
  }
  if (report.facility.company.subscriptions.length === 0) throwEsgBundleAccessDenied();
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this CSRD statement before generating it", "CSRD_REPORT_NOT_SUBMITTED");
  }
  requireCsrdReportWindowOpen(report.reportingPeriod);

  const metrics = await buildCsrdMetrics(report, report.facility, report.facility.company);
  return {
    report,
    facility: report.facility,
    metrics,
    disclosureIndex: buildDisclosureIndex(report, metrics),
  };
};
