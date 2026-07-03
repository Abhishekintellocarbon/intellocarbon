import { z } from "zod";

const optionalString = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

export const companyStep1Schema = z.object({
  name: z.string().trim().min(2, "Enter your company name").max(150),
  registrationNumber: optionalString(50),
  address: optionalString(250),
  city: optionalString(100),
  state: optionalString(100),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter a valid 6-digit PIN code")
    .optional()
    .or(z.literal("")),
});

export const companyStep2Schema = z.object({
  sector: z.enum(["STEEL", "CEMENT", "ALUMINIUM", "FERTILIZER", "HYDROGEN", "ELECTRICITY", "OTHER"], {
    error: "Select your primary sector",
  }),
  subSector: optionalString(100),
  annualTurnoverInr: optionalNumericString,
  employeeCount: optionalNumericString,
});

export const companyStep3Schema = z.object({
  reportingFyStartMonth: z.string().min(1),
  appliesCbam: z.boolean(),
  appliesCcts: z.boolean(),
  isPatDesignatedConsumer: z.boolean(),
});

export const companyWizardSchema = companyStep1Schema.merge(companyStep2Schema).merge(companyStep3Schema);
export type CompanyWizardValues = z.infer<typeof companyWizardSchema>;

export const companyStepFields: Record<number, (keyof CompanyWizardValues)[]> = {
  1: ["name", "registrationNumber", "address", "city", "state", "pincode"],
  2: ["sector", "subSector", "annualTurnoverInr", "employeeCount"],
  3: ["reportingFyStartMonth", "appliesCbam", "appliesCcts", "isPatDesignatedConsumer"],
};

// EU declarant / importer of record — used on the CBAM report's Installation
// and Declarant Details page.
export const euDeclarantSchema = z.object({
  euImporterName: optionalString(150),
  euImporterEori: optionalString(30),
  euImporterCountry: optionalString(100),
  euImporterContactEmail: z.string().trim().email("Enter a valid email").max(150).optional().or(z.literal("")),
  euImporterContactPhone: optionalString(30),
});

export const companySettingsSchema = companyWizardSchema.merge(euDeclarantSchema);
export type CompanySettingsValues = z.infer<typeof companySettingsSchema>;
