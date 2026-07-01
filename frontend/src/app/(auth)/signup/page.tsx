import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { GuestRoute } from "@/components/auth/guest-route";

export const metadata: Metadata = { title: "Create your account — Intellocarbon" };

export default function SignupPage() {
  return (
    <GuestRoute>
      <AuthShell
        title="Create your account"
        subtitle="Start tracking emissions and compliance in minutes."
      >
        <SignupForm />
      </AuthShell>
    </GuestRoute>
  );
}
