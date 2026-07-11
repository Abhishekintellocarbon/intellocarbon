const BARS = [40, 65, 50, 80, 60, 90];

const STATS = [
  { value: "6 sectors", label: "CBAM coverage" },
  { value: "9 sectors", label: "CCTS obligated" },
  { value: "AR5 + AR2/BUR3", label: "Dual GWP engine" },
  { value: "7 years", label: "Audit-ready retention" },
];

/** Decorative, illustrative-only preview content for the login page's left panel — not live data. */
export function LoginPanelPreview() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-surface-border bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            CBAM Liability &mdash; Q2 2026
          </p>
          <span className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-500">
            Preview
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold text-teal-500">&euro; 4,28,320</p>
        <div className="mt-4 flex h-14 items-end gap-1.5">
          {BARS.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}%`, backgroundColor: i % 2 === 0 ? "#00D4AA" : "#4A9EFF" }}
            />
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
