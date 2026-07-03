import { z } from "zod";

const optionalString = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

export const facilitySchema = z.object({
  name: z.string().trim().min(2, "Enter a facility name").max(150),
  facilityType: z.enum(
    [
      "INTEGRATED_STEEL_PLANT",
      "EAF_MINI_MILL",
      "DRI_PLANT",
      "ROLLING_MILL",
      "PELLET_PLANT",
      "CEMENT_PLANT",
      "ALUMINIUM_SMELTER",
      "FERTILIZER_PLANT",
      "HYDROGEN_PLANT",
      "POWER_PLANT",
      "OTHER",
    ],
    { error: "Select a facility type" },
  ),
  productionRoute: z.string().trim().min(1, "Select a production route"),
  address: optionalString(250),
  state: optionalString(100),
  district: optionalString(100),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code")
    .optional()
    .or(z.literal("")),
  latitude: optionalNumericString,
  longitude: optionalNumericString,
  installedCapacityTpa: optionalNumericString,
  commissioningYear: optionalNumericString,
  productsManufactured: z.string().trim().optional().or(z.literal("")),
  cnCodes: z.string().trim().optional().or(z.literal("")),
});

export type FacilityFormValues = z.infer<typeof facilitySchema>;
