import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightSlot, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "h-11 w-full rounded-xl border bg-surface px-4 text-sm text-foreground placeholder:text-muted",
            "outline-none transition-colors duration-150",
            "border-surface-border focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20",
            error && "border-danger/60 focus:border-danger/60 focus:ring-danger/20",
            leftIcon && "pl-10",
            rightSlot && "pr-11",
            className,
          )}
          {...props}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
