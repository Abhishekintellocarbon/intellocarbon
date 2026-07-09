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
import { createVerifierSchema, type CreateVerifierFormValues } from "@/lib/validations";
import type { AdminVerifierSummary } from "@/lib/types";

function AdminVerifiersContent() {
  const [verifiers, setVerifiers] = useState<AdminVerifierSummary[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateVerifierFormValues>({ resolver: zodResolver(createVerifierSchema) });

  const load = () => {
    adminApi.listVerifiers().then(({ verifiers }) => setVerifiers(verifiers));
  };

  useEffect(load, []);

  const onSubmit = async (values: CreateVerifierFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      const { verifier } = await adminApi.createVerifier(values);
      setVerifiers((prev) =>
        prev
          ? [...prev, { ...verifier, assignedCompanyCount: 0, active: true }].sort((a, b) => a.name.localeCompare(b.name))
          : [{ ...verifier, assignedCompanyCount: 0, active: true }],
      );
      setSuccessMessage(`${verifier.name}'s account is ready — share their email and password so they can log in at /login.`);
      reset();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't create this account.");
    }
  };

  const handleDeactivate = async (v: AdminVerifierSummary) => {
    if (
      !window.confirm(
        `Deactivate ${v.name}? They will immediately lose login access and be unassigned from all companies/facilities. Their historical actions will remain on record. This can be reversed later.`,
      )
    )
      return;
    setStatusChangingId(v.id);
    setServerError(null);
    try {
      await adminApi.deactivateVerifier(v.id);
      setVerifiers((prev) =>
        prev?.map((x) => (x.id === v.id ? { ...x, active: false, assignedCompanyCount: 0 } : x)) ?? prev,
      );
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't deactivate this account.");
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleReactivate = async (v: AdminVerifierSummary) => {
    if (!window.confirm(`Reactivate ${v.name}? They will regain login access but will need to be reassigned.`)) return;
    setStatusChangingId(v.id);
    setServerError(null);
    try {
      await adminApi.reactivateVerifier(v.id);
      setVerifiers((prev) => prev?.map((x) => (x.id === v.id ? { ...x, active: true } : x)) ?? prev);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Couldn't reactivate this account.");
    } finally {
      setStatusChangingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <AdminTabs />

        <h1 className="mt-6 text-2xl font-semibold">Verifiers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accredited verifiers who review submitted CBAM/CCTS data and issue verification statements. Assign
          them to companies from each company&apos;s admin page.
        </p>

        <Card className="mt-6 p-6">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-teal-500" />
            <h2 className="font-medium">Create verifier account</h2>
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

        <h2 className="mt-8 text-lg font-semibold">All verifiers</h2>
        {verifiers === null && (
          <div className="mt-6 flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          </div>
        )}
        {verifiers && verifiers.length === 0 && (
          <Card className="mt-4 flex flex-col items-center gap-2 p-10 text-center">
            <Users className="h-5 w-5 text-teal-500" />
            <p className="text-sm text-muted-foreground">No verifiers created yet.</p>
          </Card>
        )}
        {verifiers && verifiers.length > 0 && (
          <Card className="mt-4 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Companies assigned</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {verifiers.map((v) => (
                  <tr key={v.id} className="border-b border-surface-border last:border-b-0">
                    <td className="px-5 py-3 font-medium text-foreground">{v.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{v.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{v.assignedCompanyCount ?? 0}</td>
                    <td className="px-5 py-3">
                      {v.active === false ? (
                        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                          Deactivated
                        </span>
                      ) : (
                        <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-500">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {v.active === false ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={statusChangingId === v.id}
                          onClick={() => handleReactivate(v)}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={statusChangingId === v.id}
                          onClick={() => handleDeactivate(v)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
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

export default function AdminVerifiersPage() {
  return (
    <SuperAdminRoute>
      <AdminVerifiersContent />
    </SuperAdminRoute>
  );
}
