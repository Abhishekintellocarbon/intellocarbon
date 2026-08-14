"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { CHART_COLORS, fmtInr } from "@/components/dashboard/shared/dashboard-constants";
import type { FacilityDashboard } from "@/lib/types";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * CCC market price tracker — the CCTS counterpart of the CBAM certificate
 * price trend, reading the same Emission Factor Manager supersession chain
 * back as history.
 *
 * The one substantive difference: the CBAM chart can always show a price
 * because the Commission publishes one. No Carbon Credit Certificate has ever
 * traded — the CCTS compliance market opens on IEX in October 2026 — so the
 * ordinary state of this card, today, is a stated absence. It shows "market
 * not yet open" until that date, "price not yet available" once trading is
 * live but nothing has been recorded, and a price only when a Super Admin has
 * entered a real traded figure with its source. There is no placeholder,
 * projection or indicative value anywhere in this component.
 */
export function CccMarketPriceTracker({ dashboard }: { dashboard: FacilityDashboard }) {
  const { cccMarketPrice, cccMarketPriceTrend } = dashboard;

  const isAvailable = cccMarketPrice.status === "AVAILABLE";
  // One recorded price is a value, not a trend — a single bar would imply a
  // direction the data doesn't carry (same rule as the CBAM price chart).
  const hasTrend = cccMarketPriceTrend.length >= 2;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">CCC market price</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            isAvailable ? "border-teal-500/30 bg-teal-500/10 text-teal-500" : "border-warning/30 bg-warning/10 text-warning"
          }`}
        >
          {cccMarketPrice.status === "MARKET_NOT_OPEN"
            ? "Market not yet open"
            : cccMarketPrice.status === "PRICE_PENDING"
              ? "Price not yet available"
              : "Live price recorded"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Traded price of a Carbon Credit Certificate on the {cccMarketPrice.venue}, used to value this facility&apos;s CCC
        position.
      </p>

      {isAvailable ? (
        <>
          <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground">
            {fmtInr(cccMarketPrice.pricePerCreditInr)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">per CCC</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">As of {cccMarketPrice.asOfDate}</p>

          {hasTrend && (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cccMarketPriceTrend} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#22303f" vertical={false} />
                  <XAxis dataKey="asOfDate" stroke="#8AA0B4" fontSize={12} tickFormatter={fmtDate} />
                  <YAxis
                    stroke="#8AA0B4"
                    fontSize={12}
                    width={70}
                    domain={["dataMin - 50", "dataMax + 50"]}
                    tickFormatter={(v: number) => fmtInr(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    formatter={(value) => fmtInr(Number(value))}
                    labelFormatter={(label) => fmtDate(String(label))}
                    contentStyle={{ background: "#162230", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="pricePerCreditInr" name="Price" radius={[4, 4, 0, 0]}>
                    {cccMarketPriceTrend.map((point) => (
                      <Cell key={point.asOfDate} fill={point.isCurrent ? CHART_COLORS.teal : CHART_COLORS.blue} />
                    ))}
                    <LabelList
                      dataKey="pricePerCreditInr"
                      position="top"
                      formatter={(v) => fmtInr(Number(v))}
                      fontSize={11}
                      fill="#B5C0CC"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted">Source: {cccMarketPrice.source}</p>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-warning/20 bg-warning/5 p-4">
          {/* No number, no dash standing in for one, no indicative range — an
              absent market cannot be summarised as a price. */}
          <p className="text-sm font-medium text-warning">
            {cccMarketPrice.status === "MARKET_NOT_OPEN"
              ? `Trading opens ${cccMarketPrice.opensLabel}`
              : "No price recorded yet"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">{cccMarketPrice.reason}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Until then your CCC surplus or deficit is tracked in credits only. Nothing on this dashboard puts a rupee
            value on a CCC before one has traded.
          </p>
        </div>
      )}
    </Card>
  );
}
