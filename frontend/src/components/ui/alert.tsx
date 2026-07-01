import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "info";

const variantStyles: Record<AlertVariant, { wrap: string; icon: React.ReactNode }> = {
  error: {
    wrap: "border-danger/30 bg-danger/10 text-danger",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
  },
  success: {
    wrap: "border-teal-500/30 bg-teal-500/10 text-teal-500",
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
  },
  info: {
    wrap: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    icon: <Info className="h-4 w-4 shrink-0" />,
  },
};

export function Alert({ variant = "info", children }: { variant?: AlertVariant; children: React.ReactNode }) {
  const styles = variantStyles[variant];
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm", styles.wrap)}>
      {styles.icon}
      <div className="leading-snug">{children}</div>
    </div>
  );
}
