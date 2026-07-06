import { z } from "zod";

const tierSchema = z.enum(
  ["CCTS_COMPLIANCE", "CBAM_COMPLIANCE", "CBAM_PLUS_CCTS", "BRSR_CORE_REPORTING"],
  { message: "Select a valid plan" },
);

export const checkoutSchema = z.object({
  tier: tierSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// A company can hold several tiers at once, so cancellation must say which one.
export const cancelSchema = z.object({
  tier: tierSchema,
});

export type CancelInput = z.infer<typeof cancelSchema>;
