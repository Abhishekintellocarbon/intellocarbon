import { z } from "zod";

/**
 * Format checks only, exactly as the voluntary offsets validator does: a
 * positive quantity and a plausible vintage. There is no registry lookup and
 * no uniqueness constraint on the reference — rejecting a mistyped reference
 * would imply an authority over the certificate this platform does not have.
 */
export const recPurchaseSchema = z.object({
  facilityId: z.string().min(1, "Select a facility"),
  registry: z.enum(["INDIA_REC_CERC", "I_REC", "TIGR", "GUARANTEE_OF_ORIGIN", "GREEN_E", "OTHER"]),
  certificateReference: z.string().trim().min(1, "Enter the certificate reference").max(200),
  quantityMwh: z.coerce.number().positive("Quantity must be greater than zero"),
  vintageYear: z.coerce.number().int().min(1990).max(2100),
  purchaseDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type RecPurchaseInput = z.infer<typeof recPurchaseSchema>;
