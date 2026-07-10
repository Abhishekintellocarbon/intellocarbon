"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, fmtIntensity } from "./shared/dashboard-constants";
import type { CompanyFacilityComparisonPoint } from "@/lib/types";

// Only rendered by the caller when there are 2+ facilities with data — a
// single facility has nothing to compare against.
export function FacilityComparisonChart({ data }: { data: CompanyFacilityComparisonPoint[] }) {
  const unit = data[0]?.seeUnit ?? "tCO2e/t";

  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Facility comparison</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Specific Embedded Emissions ({unit}) for each facility&apos;s latest reporting period.
      </p>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
            <XAxis dataKey="facilityName" stroke="#8AA0B4" fontSize={12} />
            <YAxis stroke="#8AA0B4" fontSize={12} width={60} tickFormatter={(v: number) => fmtIntensity(v)} />
            <Tooltip
              formatter={(value, _name, item) => [`${fmtIntensity(Number(value))} ${unit}`, item.payload.periodLabel]}
              contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="actualSee" name="Specific Embedded Emissions" radius={[4, 4, 0, 0]}>
              {data.map((point) => (
                <Cell key={point.facilityId} fill={CHART_COLORS.teal} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
