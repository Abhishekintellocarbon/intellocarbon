"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { authApi, ApiError } from "@/lib/api";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validations";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      setServerError("This reset link is missing a token. Please request a new one.");
      return;
    }
    setServerError(null);
    try {
      await authApi.resetPassword(token, values.password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  if (!token) {
    return (
      <div className="space-y-5">
        <Alert variant="error">
          This password reset link is invalid or missing a token. Please request a new one.
        </Alert>
        <Link href="/forgot-password" className="block text-center text-sm font-medium text-teal-500 hover:text-teal-400">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <Alert variant="success">
        Your password has been reset. Redirecting you to log in&hellip;
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div>
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Create a new password"
          error={Boolean(errors.password)}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
        <PasswordStrength value={watch("password") ?? ""} />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          error={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </div>

      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Reset password
      </Button>
    </form>
  );
}
