import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-teal-blue">
        <Leaf className="h-[18px] w-[18px] text-[#06120F]" strokeWidth={2.5} />
      </span>
      {!iconOnly && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Intello<span className="text-gradient">carbon</span>
        </span>
      )}
    </div>
  );
}
