import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-surface-border bg-surface px-4 py-3.5 transition-colors hover:border-teal-500/30",
          className,
        )}
      >
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-surface-raised transition-colors has-[:checked]:bg-gradient-teal-blue">
          <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    );
  },
);
Switch.displayName = "Switch";
