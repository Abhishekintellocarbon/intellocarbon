import { z } from "zod";

// Hard platform rule: no assumed values — every emission factor row must
// cite the regulation/source it comes from. Same minimum as the Emission
// Factor Manager's source field.
const sourceSchema = z.string().trim().min(5, "Cite the regulation/source this factor comes from");

const jurisdictionSchema = z.enum(["US_CALIFORNIA", "UK", "AUSTRALIA", "UAE_MIDDLE_EAST", "EU", "OTHER_GHG_PROTOCOL"]);

const scope1EntrySchema = z
  .object({
    id: z.string().min(1),
    sourceType: z.string().min(1),
    label: z.string().min(1),
    quantity: z.number(),
    unit: z.string().min(1),
    isCustom: z.boolean(),
    customFactorValue: z.number().optional(),
    source: sourceSchema,
  })
  .refine((e) => !e.isCustom || e.customFactorValue != null, {
    message: "Enter a custom factor value",
    path: ["customFactorValue"],
  });

const scope2EntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  quantityValue: z.number(),
  quantityUnit: z.enum(["kWh", "MWh"]),
  gridFactorValue: z.number(),
  source: sourceSchema,
});

// Coming soon — validated so the shape is enforced from day one, even
// though the UI doesn't let anyone populate this yet.
const scope3EntrySchema = z.object({
  id: z.string().min(1),
  scope3Category: z.number().int().min(1).max(15),
  description: z.string(),
  quantity: z.number(),
  factor: z.number(),
  source: z.string(),
});

export const createGhgEngagementSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required"),
  country: z.string().trim().min(1, "Country is required"),
  reportingPeriodStart: z.coerce.date(),
  reportingPeriodEnd: z.coerce.date(),
  jurisdiction: jurisdictionSchema,
  numberOfSites: z.number().int().positive().optional(),
  scope1Entries: z.array(scope1EntrySchema).default([]),
  scope2Entries: z.array(scope2EntrySchema).default([]),
  scope3Entries: z.array(scope3EntrySchema).default([]),
});
export type CreateGhgEngagementInput = z.infer<typeof createGhgEngagementSchema>;

// Same shape as create — the whole engagement is re-submitted on every save,
// same convention as the CBAM/CCTS activity data submit endpoint.
export const updateGhgEngagementSchema = createGhgEngagementSchema;
export type UpdateGhgEngagementInput = z.infer<typeof updateGhgEngagementSchema>;

// Live-preview endpoint — just the fields the calculation engine needs, so
// the admin can see the breakdown update before saving anything.
export const calculatePreviewSchema = z.object({
  scope1Entries: z.array(scope1EntrySchema).default([]),
  scope2Entries: z.array(scope2EntrySchema).default([]),
  jurisdiction: jurisdictionSchema,
});
export type CalculatePreviewInput = z.infer<typeof calculatePreviewSchema>;
