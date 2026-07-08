import { z } from "zod";

export const assignVerifierSchema = z.object({
  verifierId: z.string().min(1, "Select a verifier"),
});

export type AssignVerifierInput = z.infer<typeof assignVerifierSchema>;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const createVerifierSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: passwordSchema,
});

export type CreateVerifierInput = z.infer<typeof createVerifierSchema>;
