"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS } from "../shared/dashboard-constants";
import type { CompanyBrsrFacilityComparisonPoint } from "@/lib/types";

// Only rendered by the caller when there are 2+ facilities with BRSR data —
// a single facility has nothing to compare against.
export function BrsrFacilityComparisonChart({ data }: { data: CompanyBrsrFacilityComparisonPoint[] }) {
  const unit = data[0]?.unit ?? "KL";

  return (
    <Card className="rounded-[12px] p-6">
      <h2 className="text-lg font-semibold">Facility comparison — water consumption</h2>
      <p className="mt-1 text-xs text-muted-foreground">Water consumed ({unit}) for each facility&apos;s latest submitted reporting period.</p>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
            <XAxis dataKey="facilityName" stroke="#8AA0B4" fontSize={12} />
            <YAxis stroke="#8AA0B4" fontSize={12} width={60} tickFormatter={(v: number) => v.toLocaleString("en-IN")} />
            <Tooltip
              formatter={(value, _name, item) => [`${Number(value).toLocaleString("en-IN")} ${unit}`, item.payload.periodLabel]}
              contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="value" name="Water consumption" radius={[4, 4, 0, 0]}>
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
