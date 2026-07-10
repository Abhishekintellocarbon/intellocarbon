// Design-system chart colors — literal hex since Recharts fill/stroke props
// need real color values, not Tailwind classes. Shared by the per-facility
// dashboard (components/facilities/dashboard) and the company-wide
// analytics dashboard (components/dashboard) so both use the exact same palette.
export const CHART_COLORS = {
  teal: "#00D4AA",
  blue: "#4A9EFF",
  amber: "#F5A623",
  red: "#FF6B6B",
} as const;

export const EMISSIONS_SEGMENT_COLORS = [CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.red];

export const fmtEur = (n: number) => `€${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const fmtTco2e = (n: number, digits = 1) => `${n.toLocaleString("en-IN", { maximumFractionDigits: digits })} tCO2e`;
export const fmtIntensity = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
