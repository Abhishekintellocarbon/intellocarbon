import { z } from "zod";

const tierSchema = z.enum(
  ["CCTS_COMPLIANCE", "CBAM_COMPLIANCE", "CBAM_PLUS_CCTS", "BRSR_CORE_REPORTING"],
  { message: "Select a valid plan" },
);

export const checkoutSchema = z.object({
  tier: tierSchema,
  // How many facilities this subscription should cover from the start —
  // mirrors Razorpay's per-plan `quantity`. Capped at 50 as a sanity bound,
  // not a real business limit (larger needs go through the custom-deal flow).
  facilitiesIncluded: z.coerce.number().int().min(1).max(50).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// A company can hold several tiers at once, so cancellation must say which one.
export const cancelSchema = z.object({
  tier: tierSchema,
});

export type CancelInput = z.infer<typeof cancelSchema>;

// Adds one facility's worth of capacity to an already-active subscription.
export const addFacilitySchema = z.object({
  tier: tierSchema,
});

export type AddFacilityInput = z.infer<typeof addFacilitySchema>;
