import { BusinessModel, CbamFramework, OwnershipModel, Sector } from "@prisma/client";
import { z } from "zod";

const companyFields = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(150),
  registrationNumber: z.string().trim().max(50).optional().or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN")
    .optional()
    .or(z.literal("")),
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

  // Which CBAM regimes apply, once appliesCbam is on. Optional on the wire
  // so payloads written before UK CBAM existed keep validating — see the
  // normalisation below for how a missing value is resolved.
  cbamFrameworks: z.array(z.nativeEnum(CbamFramework)).max(2).optional(),

  // Scope 3 relevance drivers — see scope3Relevance.service.ts. Defaulted
  // rather than required so existing clients that PUT a company payload
  // without them keep the schema default instead of failing validation.
  ownershipModel: z.nativeEnum(OwnershipModel, { errorMap: () => ({ message: "Select a valid ownership model" }) }).default("OWNED"),
  businessModel: z.nativeEnum(BusinessModel, { errorMap: () => ({ message: "Select a valid business model" }) }).default("MANUFACTURER"),

  // EU declarant / importer of record — CBAM report page 4
  euImporterName: z.string().trim().max(150).optional().or(z.literal("")),
  euImporterEori: z.string().trim().max(30).optional().or(z.literal("")),
  euImporterCountry: z.string().trim().max(100).optional().or(z.literal("")),
  euImporterContactEmail: z.string().trim().email("Enter a valid email").max(150).optional().or(z.literal("")),
  euImporterContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
});

/**
 * `appliesCbam` stays the master on/off switch for the CBAM module and
 * `cbamFrameworks` says which regimes apply once it is on, so the two must
 * agree: appliesCbam on ⇔ at least one framework. This normalises every
 * payload to that invariant before it reaches the service, which means no
 * caller has to remember to keep them in step and no row can end up saying
 * "CBAM applies, to nothing" or "CBAM doesn't apply, but here's the EU
 * regime".
 *
 * A contradiction the client stated outright — appliesCbam with an
 * explicitly empty list — is an error rather than a silent correction: the
 * two readings ("they meant to turn it off" / "they forgot to pick one")
 * lead to different data, so the client has to say which.
 *
 * A payload that simply predates this field is a different case and is
 * resolved, not rejected: appliesCbam with no list at all means EU CBAM,
 * exactly what appliesCbam has always meant and what the backfill migration
 * assumed for existing companies.
 */
export const companySchema = companyFields
  .superRefine((data, ctx) => {
    if (data.appliesCbam && data.cbamFrameworks?.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cbamFrameworks"],
        message: "Select at least one CBAM regime (EU CBAM, UK CBAM, or both)",
      });
    }
  })
  .transform((data) => ({
    ...data,
    // Turning the module off clears the regimes rather than leaving stale
    // ones behind, so re-enabling it is always a deliberate re-selection.
    cbamFrameworks: data.appliesCbam
      ? [...new Set(data.cbamFrameworks ?? [CbamFramework.EU_CBAM])]
      : [],
  }));

export type CompanyInput = z.infer<typeof companySchema>;
