import { z } from "zod";

export const assignVerifierSchema = z.object({
  verifierId: z.string().min(1, "Select a verifier"),
});

export type AssignVerifierInput = z.infer<typeof assignVerifierSchema>;
