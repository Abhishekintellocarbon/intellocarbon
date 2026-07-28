import { z } from "zod";

const statusSchema = z.enum(["DRAFT", "FINAL"]);

export const createCctsObligatedEntitySchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  sector: z.string().trim().min(1, "Sector is required"),
  subSector: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().min(1, "State is required"),
  district: z.string().trim().max(100).optional().or(z.literal("")),
  notificationReference: z.string().trim().min(1, "Notification reference is required (e.g. \"G.S.R. 234(E)\")"),
  notificationDate: z.coerce.date(),
  status: statusSchema.default("DRAFT"),
  baselineIntensity: z.coerce.number().optional(),
  targetIntensity: z.coerce.number().optional(),
  sourceUrl: z.string().trim().max(500).optional().or(z.literal("")),
  lastVerifiedDate: z.coerce.date(),
});
export type CreateCctsObligatedEntityInput = z.infer<typeof createCctsObligatedEntitySchema>;

export const updateCctsObligatedEntitySchema = createCctsObligatedEntitySchema.partial();
export type UpdateCctsObligatedEntityInput = z.infer<typeof updateCctsObligatedEntitySchema>;

// CSV bulk import — the frontend parses the uploaded file into rows and
// posts them as JSON, so this validates the same shape as create, applied
// per-row rather than in bulk (one bad row shouldn't be a bare 400 with no
// indication of which line was wrong).
export const bulkImportCctsObligatedEntitySchema = z.object({
  rows: z.array(createCctsObligatedEntitySchema).min(1, "No rows to import").max(2000, "Import at most 2000 rows at a time"),
});
export type BulkImportCctsObligatedEntityInput = z.infer<typeof bulkImportCctsObligatedEntitySchema>;
