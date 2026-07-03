import { Sector } from "@prisma/client";
import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(150),
  registrationNumber: z.string().trim().max(50).optional().or(z.literal("")),
  sector: z.nativeEnum(Sector, { errorMap: () => ({ message: "Select a valid sector" }) }),
  subSector: z.string().trim().max(100).optional().or(z.literal("")),

  address: z.string().trim().max(250).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code")
    .optional()
    .or(z.literal("")),

  annualTurnoverInr: z.coerce.number().nonnegative().optional(),
  employeeCount: z.coerce.number().int().nonnegative().optional(),
  reportingFyStartMonth: z.coerce.number().int().min(1).max(12).default(4),

  appliesCbam: z.boolean().default(false),
  appliesCcts: z.boolean().default(false),
  isPatDesignatedConsumer: z.boolean().default(false),

  // EU declarant / importer of record — CBAM report page 4
  euImporterName: z.string().trim().max(150).optional().or(z.literal("")),
  euImporterEori: z.string().trim().max(30).optional().or(z.literal("")),
  euImporterCountry: z.string().trim().max(100).optional().or(z.literal("")),
  euImporterContactEmail: z.string().trim().email("Enter a valid email").max(150).optional().or(z.literal("")),
  euImporterContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
});

export type CompanyInput = z.infer<typeof companySchema>;
