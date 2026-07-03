import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { GuestRoute } from "@/components/auth/guest-route";
import { InactivityBanner } from "@/components/auth/inactivity-banner";

export const metadata: Metadata = { title: "Log in — Intellocarbon" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <GuestRoute>
      <InactivityBanner show={searchParams.reason === "inactivity"} />
      <AuthShell title="Welcome back" subtitle="Log in to your Intellocarbon account.">
        <LoginForm />
      </AuthShell>
    </GuestRoute>
  );
}
