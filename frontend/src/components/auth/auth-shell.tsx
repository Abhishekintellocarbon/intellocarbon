import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { BarChart3, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/ui/logo";

interface AuthShellFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const DEFAULT_FEATURES: AuthShellFeature[] = [
  {
    icon: ShieldCheck,
    title: "Automated compliance",
    description: "Stay ahead of CPCB, SPCB, and MoEFCC filings with real-time tracking.",
  },
  {
    icon: BarChart3,
    title: "Emissions intelligence",
    description: "Scope 1, 2 & 3 dashboards built for Indian regulatory frameworks.",
  },
  {
    icon: Sparkles,
    title: "Climate risk insights",
    description: "AI-driven signals to help you act before compliance becomes a crisis.",
  },
];

const DEFAULT_HEADLINE = (
  <>
    Environmental compliance and <span className="text-gradient">climate intelligence</span>, unified
  </>
);

export function AuthShell({
  children,
  title,
  subtitle,
  headline = DEFAULT_HEADLINE,
  features = DEFAULT_FEATURES,
  statLine,
  logoSize = "md",
  panelExtra,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  headline?: React.ReactNode;
  features?: AuthShellFeature[];
  statLine?: React.ReactNode;
  logoSize?: "md" | "lg";
  panelExtra?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-x-hidden overflow-y-auto border-r border-surface-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-radial-glow" />

        <Link href="/" className="relative z-10">
          <Logo size={logoSize} />
        </Link>

        <div className="relative z-10 max-w-md space-y-8">
          <h2 className="text-3xl font-semibold leading-tight text-balance">{headline}</h2>
          <div className="space-y-5">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-border bg-surface-raised">
                  <feature.icon className="h-4 w-4 text-teal-500" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{feature.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          {statLine && (
            <div className="rounded-[12px] border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-500">
              {statLine}
            </div>
          )}
          {panelExtra}
        </div>

        <p className="relative z-10 mt-6 shrink-0 text-xs text-muted">
          © {new Date().getFullYear()} Intellocarbon Solutions. All rights reserved.
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm animate-fade-in">
          <Link href="/" className="mb-10 flex justify-center lg:hidden">
            <Logo />
          </Link>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
