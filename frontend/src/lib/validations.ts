import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Must be at least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email address"),
  companyName: z.string().trim().optional(),
  password: passwordSchema,
  accountType: z.enum(["COMPANY", "VERIFIER"]),
});
export type SignupFormValues = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const createInternalOperatorSchema = z.object({
  name: z.string().trim().min(2, "Enter the operator's full name"),
  email: z.string().trim().email("Enter a valid email address"),
  password: passwordSchema,
});
export type CreateInternalOperatorFormValues = z.infer<typeof createInternalOperatorSchema>;

export const createVerifierSchema = z.object({
  name: z.string().trim().min(2, "Enter the verifier's full name"),
  email: z.string().trim().email("Enter a valid email address"),
  password: passwordSchema,
});
export type CreateVerifierFormValues = z.infer<typeof createVerifierSchema>;

export const passwordRules = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
];
