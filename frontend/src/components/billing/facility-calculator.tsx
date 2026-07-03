"use client";

import { Minus, Plus } from "lucide-react";

const MIN_FACILITIES = 1;
const MAX_FACILITIES = 5;

export function FacilityCalculator({
  pricePerFacility,
  quantity,
  onChange,
}: {
  pricePerFacility: number;
  quantity: number;
  onChange: (quantity: number) => void;
}) {
  const total = pricePerFacility * quantity;

  return (
    <div className="rounded-[12px] border border-surface-border bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facilities</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Decrease facility count"
            disabled={quantity <= MIN_FACILITIES}
            onClick={() => onChange(Math.max(MIN_FACILITIES, quantity - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-surface-border text-foreground transition-colors hover:border-teal-500/50 hover:text-teal-500 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 text-center text-sm font-semibold tabular-nums">{quantity}</span>
          <button
            type="button"
            aria-label="Increase facility count"
            disabled={quantity >= MAX_FACILITIES}
            onClick={() => onChange(Math.min(MAX_FACILITIES, quantity + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-surface-border text-foreground transition-colors hover:border-teal-500/50 hover:text-teal-500 disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground tabular-nums">
        {quantity} facilit{quantity === 1 ? "y" : "ies"} × ₹{pricePerFacility.toLocaleString("en-IN")} ={" "}
        <span className="font-semibold text-foreground">₹{total.toLocaleString("en-IN")}</span> per month
      </p>
    </div>
  );
}
