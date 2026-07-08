"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { loginSchema, type LoginFormValues } from "@/lib/validations";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);
      if (user.approvalStatus !== "APPROVED") {
        router.push("/pending-approval");
      } else if (user.role === "VERIFIER") {
        router.push("/verifier/dashboard");
      } else if (user.role === "DATA_ENTRY_INTERNAL") {
        router.push("/internal-data-entry");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div>
        <Label htmlFor="email">Email</Label>
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

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-teal-500 hover:text-teal-400">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={Boolean(errors.password)}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
        Log in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-teal-500 hover:text-teal-400">
          Sign up
        </Link>
      </p>
    </form>
  );
}
