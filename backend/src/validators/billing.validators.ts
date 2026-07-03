import { z } from "zod";

export const checkoutSchema = z.object({
  tier: z.enum(["CCTS_COMPLIANCE", "CBAM_COMPLIANCE", "CBAM_PLUS_CCTS"], {
    message: "Select a valid plan",
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
