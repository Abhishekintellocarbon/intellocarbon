import type { Metadata } from "next";
import { Globe2, MapPinned, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { GuestRoute } from "@/components/auth/guest-route";
import { InactivityBanner } from "@/components/auth/inactivity-banner";
import { LoginPanelPreview } from "@/components/auth/login-panel-preview";

export const metadata: Metadata = { title: "Log in — Intellocarbon" };

const LOGIN_FEATURES = [
  {
    icon: Globe2,
    title: "CBAM",
    description: "EU export compliance, quarterly reporting, verified Communication Packages",
  },
  {
    icon: MapPinned,
    title: "CCTS",
    description: "India's mandatory carbon market, GHG intensity tracking, BEE-format reports",
  },
  {
    icon: ShieldCheck,
    title: "Built-in verification",
    description: "No email chains, no spreadsheets",
  },
];

export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <GuestRoute>
      <InactivityBanner show={searchParams.reason === "inactivity"} />
      <AuthShell
        title="Welcome back"
        subtitle="Log in to your Intellocarbon account."
        headline="One platform. Every carbon compliance obligation."
        features={LOGIN_FEATURES}
        statLine="30,000 TPA and above? You're already CCTS-obligated."
        logoSize="lg"
        panelExtra={<LoginPanelPreview />}
      >
        <LoginForm />
      </AuthShell>
    </GuestRoute>
  );
}
