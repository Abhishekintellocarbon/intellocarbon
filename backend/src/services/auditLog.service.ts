import { prisma } from "../config/prisma";
import { logger } from "../utils/logger";
import type { AuditLogAction } from "@prisma/client";

/**
 * Fire-and-forget: a logging failure should never break the report download
 * (or whatever action triggered it) that's already succeeded by the time
 * this is called.
 */
export const logFacilityAudit = (
  facilityId: string,
  companyId: string,
  action: AuditLogAction,
  detail: string,
  userId?: string,
): void => {
  prisma.auditLog.create({ data: { facilityId, companyId, action, detail, userId } }).catch((err) => {
    logger.error(`Failed to write audit log for facility ${facilityId}`, err);
  });
};

/**
 * Company-level sibling to logFacilityAudit, for events with no associated
 * facility (manual payments, custom subscription deals).
 */
export const logCompanyAudit = (
  companyId: string,
  action: AuditLogAction,
  detail: string,
  userId?: string,
): void => {
  prisma.auditLog.create({ data: { facilityId: null, companyId, action, detail, userId } }).catch((err) => {
    logger.error(`Failed to write audit log for company ${companyId}`, err);
  });
};
