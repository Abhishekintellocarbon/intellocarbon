import { z } from "zod";

export const productSkuSchema = z.object({
  facilityId: z.string().min(1, "Select a facility"),
  name: z.string().trim().min(1, "Enter the product name").max(200),
  skuCode: z.string().trim().max(100).optional().or(z.literal("")),
  reportingPeriod: z.string().regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"'),
  productionQuantity: z.coerce.number().positive("Output must be greater than zero"),
  // Free text: a facility may track tonnes, units, square metres or litres,
  // and forcing tonnes makes the per-unit figure meaningless for anyone who
  // does not.
  unit: z.string().trim().min(1, "Enter the unit").max(40),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ProductSkuInput = z.infer<typeof productSkuSchema>;
