import { FacilityType } from "@prisma/client";
import { z } from "zod";
import { draftString, draftNumber, draftNativeEnum } from "./draft";

// Permissive schema for autosave — every field optional/nullable, no min-
// length or format checks. Used only while isDraft is true; the strict
// facilitySchema below still gates the explicit "mark complete" action.
export const facilityDraftSchema = z.object({
  name: draftString(150),
  facilityType: draftNativeEnum(FacilityType),
  productionRoute: draftString(50),
  address: draftString(250),
  state: draftString(100),
  district: draftString(100),
  pincode: draftString(6),
  latitude: draftNumber(),
  longitude: draftNumber(),
  installedCapacityTpa: draftNumber(),
  commissioningYear: draftNumber(),
  productsManufactured: z.array(z.string().trim()).optional(),
  cnCodes: z.array(z.string().trim()).optional(),
});

export type FacilityDraftInput = z.infer<typeof facilityDraftSchema>;

export const facilitySchema = z.object({
  name: z.string().trim().min(2, "Facility name must be at least 2 characters").max(150),
  facilityType: z.nativeEnum(FacilityType, { errorMap: () => ({ message: "Select a valid facility type" }) }),
  // Free-text route key, validated against the sector's option list in
  // `data/cbamReferenceData.ts` at the service layer (not a Prisma enum —
  // see the schema comment on Facility.productionRoute).
  productionRoute: z.string().trim().min(1, "Select a production route").max(50),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code")
    .optional()
    .or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  installedCapacityTpa: z.coerce.number().nonnegative().optional(),
  commissioningYear: z.coerce.number().int().min(1900).max(2100).optional(),
  productsManufactured: z.array(z.string().trim().min(1)).default([]),
  cnCodes: z.array(z.string().trim().min(1)).default([]),
});

export type FacilityInput = z.infer<typeof facilitySchema>;
