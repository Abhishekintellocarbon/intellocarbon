import { Check, X } from "lucide-react";
import { passwordRules } from "@/lib/validations";
import { cn } from "@/lib/utils";

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const passed = passwordRules.filter((rule) => rule.test(value)).length;
  const strength = passed / passwordRules.length;

  const barColor =
    strength < 0.5 ? "bg-danger" : strength < 1 ? "bg-warning" : "bg-teal-500";

  return (
    <div className="mt-2.5 space-y-2">
      <div className="flex gap-1">
        {passwordRules.map((rule, i) => (
          <span
            key={rule.label}
            className={cn(
              "h-1 flex-1 rounded-full bg-surface-border transition-colors",
              i < passed && barColor,
            )}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {passwordRules.map((rule) => {
          const ok = rule.test(value);
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-xs",
                ok ? "text-teal-500" : "text-muted",
              )}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
