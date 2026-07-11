import { Fragment } from "react";
import { ArrowRight, Calculator, ClipboardList, FileBarChart } from "lucide-react";

const WORKFLOW_STEPS = [
  { icon: ClipboardList, label: "Enter data" },
  { icon: Calculator, label: "Calculate" },
  { icon: FileBarChart, label: "Report" },
];

const STATS = [
  { value: "6 sectors", label: "CBAM coverage" },
  { value: "9 sectors", label: "CCTS obligated" },
  { value: "Minutes", label: "Reports, not weeks" },
  { value: "7 years", label: "Audit-ready records" },
];

/** Decorative, illustrative-only preview content for the login page's left panel — no live data, no methodology specifics. */
export function LoginPanelPreview() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-surface-border bg-surface p-5 shadow-card">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          From data to disclosure
        </p>
        <div className="mt-4 flex items-center">
          {WORKFLOW_STEPS.map((step, i) => (
            <Fragment key={step.label}>
              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-teal-blue">
                  <step.icon className="h-5 w-5 text-[#06120F]" strokeWidth={2.25} />
                </span>
                <p className="text-xs font-medium text-foreground">{step.label}</p>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <ArrowRight className="mb-5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">{stat.value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
