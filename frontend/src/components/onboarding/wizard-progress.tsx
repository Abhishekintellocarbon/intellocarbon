import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function WizardProgress({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const stepNumber = i + 1;
        const isComplete = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  isComplete && "border-transparent bg-gradient-teal-blue text-[#06120F]",
                  isActive && "border-teal-500 text-teal-500",
                  !isComplete && !isActive && "border-surface-border text-muted",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  isActive || isComplete ? "text-foreground" : "text-muted",
                )}
              >
                {step}
              </span>
            </div>
            {stepNumber < steps.length && (
              <div
                className={cn(
                  "mx-2 h-px flex-1 transition-colors sm:mx-3",
                  isComplete ? "bg-teal-500" : "bg-surface-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
