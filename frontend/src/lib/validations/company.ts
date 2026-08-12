import { z } from "zod";
import type { CbamFramework } from "@/lib/types";

const optionalString = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || !Number.isNaN(Number(v)), "Enter a valid number");

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
  .optional()
  .or(z.literal(""));

export const companyStep1Schema = z.object({
  name: z.string().trim().min(2, "Enter your company name").max(150),
  registrationNumber: optionalString(50),
  gstin: gstinSchema,
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
  // One switch per CBAM regime rather than a single "EU CBAM" toggle: the two
  // are independent obligations. The API's appliesCbam/cbamFrameworks pair is
  // derived from these at submit — see cbamFieldsFromForm below, the only
  // place that mapping is written.
  appliesEuCbam: z.boolean(),
  appliesUkCbam: z.boolean(),
  appliesCcts: z.boolean(),
  isPatDesignatedConsumer: z.boolean(),
});

export const companyWizardSchema = companyStep1Schema.merge(companyStep2Schema).merge(companyStep3Schema);
export type CompanyWizardValues = z.infer<typeof companyWizardSchema>;

export const companyStepFields: Record<number, (keyof CompanyWizardValues)[]> = {
  1: ["name", "registrationNumber", "address", "city", "state", "pincode"],
  2: ["sector", "subSector", "annualTurnoverInr", "employeeCount"],
  3: ["reportingFyStartMonth", "appliesEuCbam", "appliesUkCbam", "appliesCcts", "isPatDesignatedConsumer"],
};

export const CBAM_FRAMEWORK_LABELS: Record<CbamFramework, string> = {
  EU_CBAM: "EU CBAM",
  UK_CBAM: "UK CBAM",
};

/**
 * The two CBAM switches -> the API's appliesCbam + cbamFrameworks pair.
 * appliesCbam is derived, never its own control, so the master switch and the
 * regime list can't disagree; the API applies the same rule server-side.
 */
export const cbamFieldsFromForm = (values: { appliesEuCbam: boolean; appliesUkCbam: boolean }) => {
  const cbamFrameworks: CbamFramework[] = [
    ...(values.appliesEuCbam ? (["EU_CBAM"] as const) : []),
    ...(values.appliesUkCbam ? (["UK_CBAM"] as const) : []),
  ];
  return { appliesCbam: cbamFrameworks.length > 0, cbamFrameworks };
};

/**
 * The regimes a saved company is in scope for — the read-side counterpart of
 * cbamFieldsFromForm, and what every display surface should call rather than
 * reading cbamFrameworks directly. A row with appliesCbam but no frameworks
 * predates UK CBAM and reads as EU CBAM, the same resolution the API makes
 * for a legacy payload.
 */
export const cbamFrameworksOf = (company: {
  appliesCbam: boolean;
  cbamFrameworks?: CbamFramework[];
}): CbamFramework[] => {
  if (company.cbamFrameworks?.length) return company.cbamFrameworks;
  return company.appliesCbam ? ["EU_CBAM"] : [];
};

/** A saved company -> the two switches. */
export const cbamFormFromCompany = (company: { appliesCbam: boolean; cbamFrameworks?: CbamFramework[] }) => {
  const frameworks = cbamFrameworksOf(company);
  return {
    appliesEuCbam: frameworks.includes("EU_CBAM"),
    appliesUkCbam: frameworks.includes("UK_CBAM"),
  };
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

/**
 * Scope 3 relevance drivers. Settings-only, not part of the onboarding
 * wizard — existing and newly created companies take the schema defaults
 * (OWNED / MANUFACTURER) and can refine them here afterwards.
 */
export const scope3ProfileSchema = z.object({
  ownershipModel: z.enum(["OWNED", "LEASED", "MIXED"], { error: "Select an ownership model" }),
  businessModel: z.enum(["MANUFACTURER", "FRANCHISOR", "FINANCIAL_INSTITUTION", "DISTRIBUTOR"], {
    error: "Select a business model",
  }),
});

export const companySettingsSchema = companyWizardSchema.merge(euDeclarantSchema).merge(scope3ProfileSchema);
export type CompanySettingsValues = z.infer<typeof companySettingsSchema>;
