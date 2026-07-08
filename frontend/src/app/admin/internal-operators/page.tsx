"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Alert } from "@/components/ui/alert";
import { SuperAdminRoute } from "@/components/auth/super-admin-route";
import { AppHeader } from "@/components/layout/app-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { adminApi, ApiError } from "@/lib/api";
import { createInternalOperatorSchema, type CreateInternalOperatorFormValues } from "@/lib/validations";
import type { AdminInternalOperatorSummary } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function AdminInternalOperatorsContent() {
  const [operators, setOperators] = useState<AdminInternalOperatorSummary[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInternalOperatorFormValues>({ resolver: zodResolver(createInternalOperatorSchema) });

  const load = () => {
    adminApi.listInternalOperators().then(({ operators }) => setOperators(operators));
  };

  useEffect(load, []);

  const onSubmit = async (values: CreateInternalOperatorFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const { operator } = await adminApi.createInternalOperator(values);
      setOperators((prev) => (prev ? [...prev, operator].sort((a, b) => a.name.localeCompare(b.name)) : [operator]));
      setSuccessMessage(`${operator.name}'s account is ready — share their email and password so they can log in at /login.`);
      reset();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't create this account.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <AdminTabs />

        <h1 className="mt-6 text-2xl font-semibold">Internal Operators</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Intellocarbon staff who enter activity data on behalf of assigned client facilities. Assign them to
          facilities from each facility&apos;s admin page.
        </p>

        <Card className="mt-6 p-6">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-teal-500" />
            <h2 className="font-medium">Create internal operator account</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 grid gap-4 sm:grid-cols-3" noValidate>
            {serverError && (
              <div className="sm:col-span-3">
                <Alert variant="error">{serverError}</Alert>
              </div>
            )}
            {successMessage && (
              <div className="sm:col-span-3">
                <Alert variant="success">{successMessage}</Alert>
              </div>
            )}

            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" error={Boolean(errors.name)} {...register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" error={Boolean(errors.email)} {...register("email")} />
              <FieldError message={errors.email?.message} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" error={Boolean(errors.password)} {...register("password")} />
              <FieldError message={errors.password?.message} />
            </div>

            <div className="sm:col-span-3">
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Create account
              </Button>
            </div>
          </form>
        </Card>

        <h2 className="mt-8 text-lg font-semibold">All internal operators</h2>
        {operators === null && (
          <div className="mt-6 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}
        {operators && operators.length === 0 && (
          <Card className="mt-4 flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-muted-foreground">No internal operators created yet.</p>
          </Card>
        )}
        {operators && operators.length > 0 && (
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3 font-medium text-foreground">{op.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{op.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmtDate(op.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  );
}

export default function AdminInternalOperatorsPage() {
  return (
    <SuperAdminRoute>
      <AdminInternalOperatorsContent />
    </SuperAdminRoute>
  );
}
