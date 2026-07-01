import { z } from "zod";

export const checkoutSchema = z.object({
  tier: z.enum(["STARTER", "GROWTH", "ENTERPRISE"], {
    message: "Select a valid plan",
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
