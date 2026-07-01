import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { GuestRoute } from "@/components/auth/guest-route";

export const metadata: Metadata = { title: "Log in — Intellocarbon" };

export default function LoginPage() {
  return (
    <GuestRoute>
      <AuthShell title="Welcome back" subtitle="Log in to your Intellocarbon account.">
        <LoginForm />
      </AuthShell>
    </GuestRoute>
  );
}
