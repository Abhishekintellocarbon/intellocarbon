import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  md: {
    wrapper: "gap-2.5",
    badge: "h-8 w-8 rounded-lg",
    icon: "h-[18px] w-[18px]",
    text: "text-lg",
  },
  lg: {
    wrapper: "gap-3.5",
    badge: "h-12 w-12 rounded-xl",
    icon: "h-7 w-7",
    text: "text-3xl",
  },
} as const;

export function Logo({
  className,
  iconOnly,
  size = "md",
}: {
  className?: string;
  iconOnly?: boolean;
  size?: keyof typeof SIZE_STYLES;
}) {
  const s = SIZE_STYLES[size];

  return (
    <div className={cn("flex items-center", s.wrapper, className)}>
      <span className={cn("flex shrink-0 items-center justify-center bg-gradient-teal-blue", s.badge)}>
        <Leaf className={cn("text-[#06120F]", s.icon)} strokeWidth={2.5} />
      </span>
      {!iconOnly && (
        <span className={cn("font-semibold tracking-tight text-foreground", s.text)}>
          Intello<span className="text-gradient">carbon</span>
        </span>
      )}
    </div>
  );
}
