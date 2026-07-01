"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { signupSchema, type SignupFormValues } from "@/lib/validations";

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { accountType: "COMPANY" },
  });

  const accountType = watch("accountType");

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null);
    try {
      await signup(values);
      router.push(values.accountType === "VERIFIER" ? "/verifier/dashboard" : "/dashboard");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-surface-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setValue("accountType", "COMPANY")}
          className={cn(
            "rounded-lg py-2 text-sm font-medium transition-colors",
            accountType === "COMPANY" ? "bg-surface-raised text-foreground" : "text-muted-foreground",
          )}
        >
          Company account
        </button>
        <button
          type="button"
          onClick={() => setValue("accountType", "VERIFIER")}
          className={cn(
            "rounded-lg py-2 text-sm font-medium transition-colors",
            accountType === "VERIFIER" ? "bg-surface-raised text-foreground" : "text-muted-foreground",
          )}
        >
          I&apos;m a verifier
        </button>
      </div>

      {accountType === "VERIFIER" && (
        <Alert variant="info">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Verifier accounts review companies&apos; submitted emissions data and approve or reject
              verification requests. No company setup needed.
            </span>
          </div>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          leftIcon={<User className="h-4 w-4" />}
          placeholder="Aditi Sharma"
          error={Boolean(errors.name)}
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div>
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          leftIcon={<Mail className="h-4 w-4" />}
          placeholder="you@company.com"
          error={Boolean(errors.email)}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      {accountType === "COMPANY" && (
        <div>
          <Label htmlFor="companyName">
            Company <span className="text-muted">(optional)</span>
          </Label>
          <Input
            id="companyName"
            autoComplete="organization"
            leftIcon={<Building2 className="h-4 w-4" />}
            placeholder="Acme Manufacturing Pvt. Ltd."
            {...register("companyName")}
          />
        </div>
      )}

      <div>
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Create a strong password"
          error={Boolean(errors.password)}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
        <PasswordStrength value={watch("password") ?? ""} />
      </div>

      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Create account
      </Button>

      <p className="text-center text-xs text-muted">
        By signing up, you agree to Intellocarbon&apos;s Terms of Service and Privacy Policy.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-500 hover:text-teal-400">
          Log in
        </Link>
      </p>
    </form>
  );
}
