import { z } from "zod";

const tierSchema = z.enum(["CCTS_COMPLIANCE", "CBAM_COMPLIANCE", "CBAM_PLUS_CCTS", "BRSR_CORE_REPORTING"]);

export const recordManualPaymentSchema = z
  .object({
    companyId: z.string().trim().min(1, "Company is required"),
    tier: tierSchema,
    amount: z.number({ invalid_type_error: "Amount must be a number" }).positive("Enter a positive amount"),
    paymentMode: z.enum(["CHEQUE", "NEFT", "RTGS", "UPI", "CASH", "OTHER"]),
    referenceNumber: z.string().trim().max(200).optional().or(z.literal("")),
    paymentDate: z.coerce.date(),
    // Set explicitly by the Super Admin — not auto-calculated — since
    // manual deals can be monthly, quarterly, or annual.
    validUntil: z.coerce.date(),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((data) => data.validUntil > data.paymentDate, {
    message: "Valid-until date must be after the payment date",
    path: ["validUntil"],
  });
export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>;

export const reverseManualPaymentSchema = z.object({
  reason: z.string().trim().min(5, "Explain why this payment is being reversed"),
});
export type ReverseManualPaymentInput = z.infer<typeof reverseManualPaymentSchema>;

export const setCustomSubscriptionSchema = z.object({
  tier: tierSchema,
  isCustomDeal: z.boolean().default(true),
  customAmount: z.number({ invalid_type_error: "Amount must be a number" }).positive().optional(),
  customFacilityCount: z.number({ invalid_type_error: "Facility count must be a number" }).int().positive().optional(),
  customValidFrom: z.coerce.date().optional(),
  customValidUntil: z.coerce.date().optional(),
  customDealNotes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type SetCustomSubscriptionInput = z.infer<typeof setCustomSubscriptionSchema>;
