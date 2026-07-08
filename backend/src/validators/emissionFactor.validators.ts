import { z } from "zod";

// Hard platform rule: no assumed values — every emission factor save must
// cite the regulation/annex it comes from. A bare "TBD" or single word
// wouldn't satisfy that, hence the minimum length rather than just non-empty.
const sourceSchema = z.string().trim().min(5, "Cite the regulation and annex this value comes from");

export const createEmissionFactorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  fuelType: z.string().trim().max(100).optional().or(z.literal("")),
  greenhouseGas: z.string().trim().max(50).optional().or(z.literal("")),
  value: z.number({ invalid_type_error: "Value must be a number" }),
  unit: z.string().trim().min(1, "Unit is required"),
  source: sourceSchema,
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  sectorApplicability: z.string().trim().max(50).optional().or(z.literal("")),
});
export type CreateEmissionFactorInput = z.infer<typeof createEmissionFactorSchema>;

// Metadata-only correction on the current record — never changes value
// without going through /supersede, so history stays intact.
export const updateEmissionFactorSchema = z.object({
  name: z.string().trim().min(1).optional(),
  fuelType: z.string().trim().max(100).optional().or(z.literal("")),
  greenhouseGas: z.string().trim().max(50).optional().or(z.literal("")),
  unit: z.string().trim().min(1).optional(),
  source: sourceSchema,
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  sectorApplicability: z.string().trim().max(50).optional().or(z.literal("")),
});
export type UpdateEmissionFactorInput = z.infer<typeof updateEmissionFactorSchema>;

export const supersedeEmissionFactorSchema = z.object({
  value: z.number({ invalid_type_error: "Value must be a number" }),
  source: sourceSchema,
});
export type SupersedeEmissionFactorInput = z.infer<typeof supersedeEmissionFactorSchema>;

export const quickUpdateValueSchema = z.object({
  value: z.number({ invalid_type_error: "Value must be a number" }).positive("Enter a positive value"),
  source: sourceSchema,
});
export type QuickUpdateValueInput = z.infer<typeof quickUpdateValueSchema>;
