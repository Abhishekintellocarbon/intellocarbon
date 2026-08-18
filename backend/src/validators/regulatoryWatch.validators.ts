import { z } from "zod";

export const watchEntrySchema = z.object({
  regime: z.enum(["ICVCM", "ARTICLE_6_PACM", "DIGITAL_PRODUCT_PASSPORT", "TNFD", "OTHER"]),
  title: z.string().trim().min(1, "Enter a title").max(300),
  summary: z.string().trim().min(1, "Enter a summary").max(4000),
  status: z.enum(["MONITORING", "DRAFT_PUBLISHED", "ADOPTED", "IN_FORCE", "SUPERSEDED"]).optional(),
  sourceUrl: z.string().trim().url("Enter a valid URL").max(500).optional().or(z.literal("")),
  nextMilestone: z.string().trim().max(200).optional().or(z.literal("")),
});

export type WatchEntryInputParsed = z.infer<typeof watchEntrySchema>;
