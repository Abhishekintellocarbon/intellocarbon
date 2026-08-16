import { prisma } from "../config/prisma";
import { AppError } from "../utils/AppError";
import { requireOwnedFacilityForEsgBundle, throwEsgBundleAccessDenied } from "./esgBundleAccess.service";
import { isGriReportWindowOpen, griUnlockDate } from "../data/complianceDeadlines";
import { GRI_TOPIC_STANDARDS, getGriTopic } from "../data/griStandards";
import {
  buildGriMetrics,
  computeImpactSignificance,
  rankTopicsByImpacts,
  topicLabel,
  GRI_REPORT_INCLUDE,
  type GriReportWithRelations,
} from "./griCalculation.service";
import { buildContentIndex } from "./griContentIndex.service";
import {
  parseTopicPayload,
  type GriDataInput,
  type GriMaterialityAssessmentInput,
} from "../validators/gri.validators";

const fmtUnlockDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// The actual security boundary — same pattern as BRSR Core's
// requireBrsrReportWindowOpen and ISSB's requireIssbReportWindowOpen.
const requireGriReportWindowOpen = (reportingPeriod: string, now: Date = new Date()): void => {
  if (!isGriReportWindowOpen(reportingPeriod, now)) {
    throw AppError.forbidden(
      `Report generation for ${reportingPeriod} opens on ${fmtUnlockDate(griUnlockDate(reportingPeriod))}`,
      "REPORT_WINDOW_CLOSED",
    );
  }
};

const requireDraft = (report: { status: string } | null, submit: boolean): void => {
  if (report && report.status === "SUBMITTED" && !submit) {
    throw AppError.badRequest(
      "This GRI report has already been submitted — resubmit explicitly to edit it",
      "GRI_REPORT_NOT_DRAFT",
    );
  }
};

/**
 * Finds or creates the GriReport row for a (facility, period). Every GRI
 * sub-resource — the materiality assessment, universal disclosures, each topic
 * — hangs off this parent, so both entry points (materiality and disclosure
 * data) need it to exist before they can write anything.
 */
const upsertReportShell = async (companyId: string, facilityId: string, reportingPeriod: string) =>
  prisma.griReport.upsert({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    create: { companyId, facilityId, reportingPeriod },
    update: {},
  });

export const listGriReports = async (userId: string, facilityId: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);
  return prisma.griReport.findMany({
    where: { facilityId },
    orderBy: { reportingPeriod: "desc" },
    include: {
      materialityAssessment: { select: { completedAt: true, materialityThreshold: true } },
      materialTopics: { select: { topicCode: true, isMaterial: true, rank: true } },
    },
  });
};

// ---------------------------------------------------------------------------
// Materiality assessment (GRI 3-1)
// ---------------------------------------------------------------------------

/**
 * Saves the materiality assessment and, as its real output, recomputes which
 * Topic Standards are material.
 *
 * The gating is derived here rather than left to the client: impacts are
 * scored server-side by computeImpactSignificance, ranked by
 * rankTopicsByImpacts, and written to GriMaterialTopic. A topic whose score
 * clears the disclosed threshold becomes material; one that doesn't is
 * recorded as assessed-and-excluded rather than dropped, because GRI requires
 * the report to be explicit about what was considered.
 *
 * Existing GRI 3-3 narrative and any hand-set not-material rationale survive a
 * re-run — GRI expects the assessment to be repeated each period, and losing a
 * year's management-approach write-up because a score moved would be a data
 * loss bug, not a recalculation.
 */
export const saveMaterialityAssessment = async (
  userId: string,
  facilityId: string,
  input: GriMaterialityAssessmentInput,
) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const existingReport = await prisma.griReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
  });

  /**
   * A submitted report accepts a completed re-run, but not a background
   * autosave.
   *
   * Blocking both outright would mean a facility that submits and then spots a
   * mis-scored impact can never correct its material topics — there is no
   * resubmit path for the assessment the way there is for disclosure data, so
   * the report would be wrong permanently. Allowing a silent draft save on a
   * submitted report is the opposite problem: it would let a half-edited
   * assessment quietly change the published set of material topics.
   *
   * So `complete: true` is the escape hatch, and if it moves the material set
   * the report drops back to DRAFT (see the end of this function).
   */
  requireDraft(existingReport, input.complete === true);

  const report = await upsertReportShell(facility.companyId, facilityId, input.reportingPeriod);

  const threshold = input.materialityThreshold ?? 3;
  const scoredImpacts = (input.impacts ?? []).map((impact) => ({
    topicCode: impact.topicCode,
    description: impact.description,
    impactType: impact.impactType,
    valueChainLocation: impact.valueChainLocation,
    scale: impact.scale,
    scope: impact.scope,
    irremediability: impact.irremediability ?? null,
    likelihood: impact.likelihood ?? null,
    significanceScore: computeImpactSignificance(impact),
  }));

  const assessmentData = {
    stakeholderGroups: input.stakeholderGroups ?? [],
    stakeholderEngagementApproach: input.stakeholderEngagementApproach || null,
    impactIdentificationProcess: input.impactIdentificationProcess || null,
    prioritisationProcess: input.prioritisationProcess || null,
    materialityThreshold: threshold,
    completedAt: input.complete ? new Date() : null,
  };

  // Impacts are a full replace (deleteMany then create), matching how
  // ActivityData handles its child entries — the client always sends the
  // complete list, and diffing would leave orphans when a row is removed.
  const assessment = await prisma.$transaction(async (tx) => {
    const saved = await tx.griMaterialityAssessment.upsert({
      where: { griReportId: report.id },
      create: { griReportId: report.id, ...assessmentData },
      update: assessmentData,
    });

    await tx.griImpact.deleteMany({ where: { assessmentId: saved.id } });
    if (scoredImpacts.length > 0) {
      await tx.griImpact.createMany({
        data: scoredImpacts.map((i) => ({ ...i, assessmentId: saved.id })),
      });
    }
    return saved;
  });

  const rankings = rankTopicsByImpacts(scoredImpacts, threshold);
  const rankingByTopic = new Map(rankings.map((r) => [r.topicCode, r]));

  const existingTopics = new Map(
    (await prisma.griMaterialTopic.findMany({ where: { griReportId: report.id } })).map((t) => [t.topicCode, t]),
  );

  const autoRationale = (ranking: { significanceScore: number } | undefined): string =>
    ranking
      ? `Assessed with a highest impact significance of ${ranking.significanceScore.toFixed(2)}, below the disclosed materiality threshold of ${threshold.toFixed(2)}.`
      : "No actual or potential impacts were identified for this topic during the materiality assessment.";

  // Write a GriMaterialTopic row for every topic in the registry, not only the
  // ones with impacts: a topic nobody raised an impact against is still a
  // topic that was assessed and excluded, and the content index has to say so.
  for (const standard of GRI_TOPIC_STANDARDS) {
    const ranking = rankingByTopic.get(standard.code);
    const isMaterial = ranking?.meetsThreshold ?? false;
    const significanceScore = ranking?.significanceScore ?? null;
    const existing = existingTopics.get(standard.code);

    /**
     * The rationale has to describe the CURRENT determination.
     *
     * A topic that gains impacts on a re-run but still falls below the
     * threshold would otherwise keep its original "no impacts were
     * identified" line — which is now false, and prints verbatim in the
     * content index. So the auto rationale is regenerated whenever the
     * determination moved.
     *
     * It is preserved only when the determination is genuinely unchanged
     * (same topic, same score, still not material), because the stored text
     * may have been rewritten by the user via the disclosure form and there
     * is nothing stale about it in that case.
     */
    const determinationUnchanged =
      existing != null && existing.isMaterial === false && existing.significanceScore === significanceScore;

    const notMaterialRationale = isMaterial
      ? null
      : determinationUnchanged && existing?.notMaterialRationale
        ? existing.notMaterialRationale
        : autoRationale(ranking);

    await prisma.griMaterialTopic.upsert({
      where: { griReportId_topicCode: { griReportId: report.id, topicCode: standard.code } },
      create: {
        griReportId: report.id,
        topicCode: standard.code,
        isMaterial,
        significanceScore,
        rank: isMaterial ? (ranking?.rank ?? null) : null,
        notMaterialRationale,
      },
      update: {
        isMaterial,
        significanceScore,
        rank: isMaterial ? (ranking?.rank ?? null) : null,
        // Always written, never conditional: clearing it when a topic becomes
        // material stops a stale "not material because..." surviving into a
        // report that now discloses the topic in full, and rewriting it when
        // the score moved stops a stale explanation of a superseded result.
        notMaterialRationale,
      },
    });
  }

  // Re-running the assessment on an already-submitted report is allowed (see
  // the guard at the top of this function), but it can change which topics are
  // material — and a submitted report whose material set has moved no longer
  // matches the disclosure data behind it. Dropping it back to DRAFT forces an
  // explicit resubmit, which re-runs the "material topic has no data" check
  // and keeps the report body and the content index from diverging.
  const materialSetChanged = GRI_TOPIC_STANDARDS.some((standard) => {
    const before = existingTopics.get(standard.code)?.isMaterial ?? false;
    const after = rankingByTopic.get(standard.code)?.meetsThreshold ?? false;
    return before !== after;
  });

  if (materialSetChanged && existingReport?.status === "SUBMITTED") {
    await prisma.griReport.update({ where: { id: report.id }, data: { status: "DRAFT" } });
  }

  return { assessment, rankings, materialSetChanged };
};

export const getMaterialityAssessment = async (userId: string, facilityId: string, reportingPeriod: string) => {
  await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.griReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: {
      materialityAssessment: { include: { impacts: { orderBy: { significanceScore: "desc" } } } },
      materialTopics: { orderBy: [{ isMaterial: "desc" }, { rank: "asc" }] },
    },
  });

  if (!report) {
    return { report: null, assessment: null, materialTopics: [], rankings: [] };
  }

  const threshold = report.materialityAssessment?.materialityThreshold ?? 3;
  return {
    report: { id: report.id, reportingPeriod: report.reportingPeriod, status: report.status },
    assessment: report.materialityAssessment,
    materialTopics: report.materialTopics,
    rankings: rankTopicsByImpacts(report.materialityAssessment?.impacts ?? [], threshold),
  };
};

// ---------------------------------------------------------------------------
// Disclosure data entry
// ---------------------------------------------------------------------------

/** Prisma delegate for a topic's disclosure table, resolved from the registry's relation name. */
const topicDelegate = (relation: string) => {
  const delegates: Record<string, { upsert: (args: unknown) => Promise<unknown> }> = {
    materialsDisclosure: prisma.griMaterialsDisclosure as never,
    energyDisclosure: prisma.griEnergyDisclosure as never,
    waterDisclosure: prisma.griWaterDisclosure as never,
    biodiversityDisclosure: prisma.griBiodiversityDisclosure as never,
    emissionsDisclosure: prisma.griEmissionsDisclosure as never,
    wasteDisclosure: prisma.griWasteDisclosure as never,
    supplierEnvDisclosure: prisma.griSupplierEnvDisclosure as never,
    employmentDisclosure: prisma.griEmploymentDisclosure as never,
    ohsDisclosure: prisma.griOhsDisclosure as never,
    trainingDisclosure: prisma.griTrainingDisclosure as never,
    diversityDisclosure: prisma.griDiversityDisclosure as never,
    nonDiscriminationDisclosure: prisma.griNonDiscriminationDisclosure as never,
    localCommunitiesDisclosure: prisma.griLocalCommunitiesDisclosure as never,
    supplierSocialDisclosure: prisma.griSupplierSocialDisclosure as never,
    customerHsDisclosure: prisma.griCustomerHsDisclosure as never,
    customerPrivacyDisclosure: prisma.griCustomerPrivacyDisclosure as never,
  };
  return delegates[relation];
};

/** `""` is how the wire represents a cleared field; `undefined` means untouched. */
const normalise = (value: unknown): unknown => (value === "" || value === undefined ? null : value);

const normaliseRow = (payload: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) out[key] = normalise(value);
  return out;
};

/**
 * Saves universal disclosures, per-topic GRI 3-3 narrative, and any topic
 * disclosure payloads in one call.
 *
 * Materiality gating is enforced here, not merely reflected in the UI: writing
 * disclosure data for a topic the assessment marked not material is rejected.
 * Without that, a stale form could reintroduce data for an excluded topic and
 * the content index would disagree with the report body.
 */
export const saveGriData = async (userId: string, facilityId: string, input: GriDataInput, submit: boolean) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const existing = await prisma.griReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod: input.reportingPeriod } },
    include: { materialTopics: true, materialityAssessment: { select: { completedAt: true } } },
  });
  requireDraft(existing, submit);

  // GRI 3 is the mandatory starting point: without a completed assessment
  // there is no basis for deciding which Topic Standards to report, so
  // disclosure entry cannot begin.
  if (!existing?.materialityAssessment?.completedAt) {
    throw AppError.badRequest(
      "Complete the GRI 3 materiality assessment before entering disclosure data — it determines which Topic Standards apply",
      "GRI_MATERIALITY_INCOMPLETE",
    );
  }

  const report = await upsertReportShell(facility.companyId, facilityId, input.reportingPeriod);
  const materialByCode = new Map(existing.materialTopics.map((t) => [t.topicCode, t.isMaterial]));

  // Only written when the key is actually present. The draft convention is
  // that an autosave carries every field with null meaning "cleared", so a
  // full payload still clears correctly — but a partial call (one section, or
  // an API client sending only what it changed) must not silently wipe the
  // fields it did not mention. Writing unconditionally does exactly that, and
  // it is invisible until someone notices a number has vanished. Same fix as
  // saveCsrdData, where a test caught it.
  await prisma.griReport.update({
    where: { id: report.id },
    data: {
      ...("turnoverInr" in input ? { turnoverInr: normalise(input.turnoverInr) as number | null } : {}),
      ...("notes" in input ? { notes: (normalise(input.notes) as string | null) ?? null } : {}),
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  });

  if (input.universal) {
    const data = normaliseRow(input.universal);
    await prisma.griUniversalDisclosures.upsert({
      where: { griReportId: report.id },
      create: { griReportId: report.id, ...data },
      update: data,
    });
  }

  // GRI 3-3 narrative per topic. isMaterial itself is NOT writable here — it
  // is an output of the materiality assessment, and letting the disclosure
  // form flip it would let a user bypass the assessment entirely.
  for (const topic of input.materialTopics ?? []) {
    if (!getGriTopic(topic.topicCode)) {
      throw AppError.badRequest(`Unknown GRI topic "${topic.topicCode}"`, "GRI_UNKNOWN_TOPIC");
    }
    await prisma.griMaterialTopic.update({
      where: { griReportId_topicCode: { griReportId: report.id, topicCode: topic.topicCode } },
      data: {
        impactsDescription: normalise(topic.impactsDescription) as string | null,
        involvementDescription: normalise(topic.involvementDescription) as string | null,
        policiesCommitments: normalise(topic.policiesCommitments) as string | null,
        actionsTaken: normalise(topic.actionsTaken) as string | null,
        effectivenessTracking: normalise(topic.effectivenessTracking) as string | null,
        stakeholderEngagement: normalise(topic.stakeholderEngagement) as string | null,
        // Only a not-material topic's rationale is writable — a material topic
        // has nothing to explain away.
        ...(materialByCode.get(topic.topicCode) === false
          ? { notMaterialRationale: normalise(topic.notMaterialRationale) as string | null }
          : {}),
      },
    });
  }

  for (const [topicCode, payload] of Object.entries(input.topics ?? {})) {
    const standard = getGriTopic(topicCode);
    if (!standard) {
      throw AppError.badRequest(`Unknown GRI topic "${topicCode}"`, "GRI_UNKNOWN_TOPIC");
    }
    if (materialByCode.get(topicCode) !== true) {
      throw AppError.badRequest(
        `${topicLabel(topicCode)} was not assessed as material for this facility — re-run the materiality assessment before disclosing it`,
        "GRI_TOPIC_NOT_MATERIAL",
      );
    }

    const parsed = parseTopicPayload(topicCode, payload, submit);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.message, "VALIDATION_ERROR");
    }

    const data = normaliseRow(parsed.data);
    const delegate = topicDelegate(standard.relation);
    await delegate.upsert({
      where: { griReportId: report.id },
      create: { griReportId: report.id, ...data },
      update: data,
    });
  }

  // Submitting a report that can't back its own claims is the failure mode
  // this module exists to prevent, so submit re-evaluates and refuses on a
  // material topic with no data. "In accordance" vs "with reference" is a
  // softer distinction and is decided at render time, not blocked here.
  if (submit) {
    const full = await loadReport(report.id);
    const metrics = await buildGriMetrics(full, facility, facility.company);
    const emptyMaterialTopics = metrics.accordance.topics.filter((t) => t.isMaterial && !t.hasAnyData);
    if (emptyMaterialTopics.length > 0) {
      throw AppError.badRequest(
        `These topics are material but have no disclosure data: ${emptyMaterialTopics.map((t) => `${t.label} ${t.title}`).join(", ")}`,
        "GRI_MATERIAL_TOPIC_EMPTY",
      );
    }
  }

  return loadReport(report.id);
};

const loadReport = async (id: string): Promise<GriReportWithRelations> => {
  const report = await prisma.griReport.findUnique({ where: { id }, include: GRI_REPORT_INCLUDE });
  if (!report) throw AppError.notFound("GRI report not found");
  return report;
};

// ---------------------------------------------------------------------------
// Report retrieval
// ---------------------------------------------------------------------------

export const getGriReportData = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.griReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: GRI_REPORT_INCLUDE,
  });
  if (!report) {
    throw AppError.notFound("GRI report not found for this facility and reporting period");
  }
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this GRI report before generating it", "GRI_REPORT_NOT_SUBMITTED");
  }
  requireGriReportWindowOpen(reportingPeriod);

  const metrics = await buildGriMetrics(report, facility, facility.company);
  const contentIndex = buildContentIndex(report, metrics);
  return { report, facility, metrics, contentIndex };
};

/**
 * Draft-safe read for the disclosure form — unlike getGriReportData this does
 * not require SUBMITTED, since the form needs to load a half-finished report.
 */
export const getGriDraft = async (userId: string, facilityId: string, reportingPeriod: string) => {
  const facility = await requireOwnedFacilityForEsgBundle(userId, facilityId);

  const report = await prisma.griReport.findUnique({
    where: { facilityId_reportingPeriod: { facilityId, reportingPeriod } },
    include: GRI_REPORT_INCLUDE,
  });
  if (!report) return { report: null, metrics: null };

  const metrics = await buildGriMetrics(report, facility, facility.company);
  return { report, metrics };
};

export const getGriReportContextById = async (userId: string, reportId: string) => {
  const report = await prisma.griReport.findUnique({
    where: { id: reportId },
    include: {
      ...GRI_REPORT_INCLUDE,
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
    throw AppError.notFound("GRI report not found");
  }
  if (report.facility.company.subscriptions.length === 0) {
    throwEsgBundleAccessDenied();
  }
  if (report.status !== "SUBMITTED") {
    throw AppError.badRequest("Submit this GRI report before generating it", "GRI_REPORT_NOT_SUBMITTED");
  }
  requireGriReportWindowOpen(report.reportingPeriod);

  const metrics = await buildGriMetrics(report, report.facility, report.facility.company);
  const contentIndex = buildContentIndex(report, metrics);
  return { report, facility: report.facility, metrics, contentIndex };
};
