"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { leadContactSchema, type LeadContactValues } from "@/lib/validations/intellocalc";

export function LeadCaptureModal({
  open,
  onClose,
  title,
  description,
  ctaLabel,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  ctaLabel: string;
  onSubmit: (values: LeadContactValues) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadContactValues>({ resolver: zodResolver(leadContactSchema) });

  if (!open) return null;

  const submit = async (values: LeadContactValues) => {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-fade-in">
      <Card className="relative w-full max-w-md p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <form onSubmit={handleSubmit(submit)} noValidate className="mt-5 space-y-4">
          {serverError && <Alert variant="error">{serverError}</Alert>}

          <div>
            <Label htmlFor="lead-name">Your name</Label>
            <Input id="lead-name" placeholder="Full name" {...register("name")} error={Boolean(errors.name)} />
            <FieldError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="lead-company">Company name</Label>
            <Input
              id="lead-company"
              placeholder="Your company"
              {...register("company")}
              error={Boolean(errors.company)}
            />
            <FieldError message={errors.company?.message} />
          </div>

          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              placeholder="you@company.com"
              {...register("email")}
              error={Boolean(errors.email)}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <Label htmlFor="lead-phone">Phone (optional)</Label>
            <Input id="lead-phone" placeholder="+91" {...register("phone")} error={Boolean(errors.phone)} />
            <FieldError message={errors.phone?.message} />
          </div>

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            {ctaLabel}
          </Button>
        </form>
      </Card>
    </div>
  );
}
