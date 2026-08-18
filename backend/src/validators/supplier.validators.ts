import { z } from "zod";

/**
 * Format checks only. Nothing here is validated against the outside world:
 * the supplier name, sector and risk flag are the company's own record of its
 * own supplier, and this platform has no standing to reject any of it.
 */
export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier name").max(200),
  sector: z.string().trim().max(120).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  hasEsgDisclosure: z.boolean().optional(),
  esgDisclosureType: z.string().trim().max(200).optional().or(z.literal("")),
  riskFlag: z.enum(["LOW", "MEDIUM", "HIGH", "NOT_ASSESSED"]).optional(),
  riskNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  spendSharePct: z.coerce.number().min(0).max(100).optional(),
  lastReviewedAt: z.coerce.date().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
