import { FacilityType, ProductionRoute } from "@prisma/client";
import { z } from "zod";

export const facilitySchema = z.object({
  name: z.string().trim().min(2, "Facility name must be at least 2 characters").max(150),
  facilityType: z.nativeEnum(FacilityType, { errorMap: () => ({ message: "Select a valid facility type" }) }),
  productionRoute: z.nativeEnum(ProductionRoute, {
    errorMap: () => ({ message: "Select a valid production route" }),
  }),
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
});

export type FacilityInput = z.infer<typeof facilitySchema>;
