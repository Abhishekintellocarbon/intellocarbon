"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function IntelloCalcFloatingCta({ watchId }: { watchId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "-96px 0px -96px 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  return (
    <>
      {/* Mobile / tablet — inline card, placed right after the hero's feature cards */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-4 xl:hidden">
        <Card className="flex flex-col items-center gap-4 rounded-[12px] border-teal-500/20 bg-gradient-radial-glow p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-base font-semibold text-foreground">
              Free: Check your CBAM exposure in 60 seconds
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No signup required — try IntelloCalc, our free public estimator.
            </p>
          </div>
          <Link href="/intellocalc" className="shrink-0">
            <Button size="sm" className="rounded-[8px]">
              Try IntelloCalc
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      </div>

      {/*
        Desktop — floating card anchored in the side gutter, visible while scrolling the middle sections.
        Right offset is derived from the page's max-w-4xl (896px) content column so the card always sits
        just outside it with a constant gap, instead of relying on a fixed breakpoint guess that could
        overlap the content on narrower "xl" widths (1280–1535px).
      */}
      <div
        className={`pointer-events-none fixed top-1/2 z-40 hidden w-44 -translate-y-1/2 transition-all duration-300 xl:block ${
          visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
        }`}
        style={{ right: "max(8px, calc((100vw - 896px) / 2 - 184px))" }}
      >
        <Card
          className={`border-teal-500/20 bg-gradient-radial-glow p-4 shadow-glow ${
            visible ? "pointer-events-auto" : ""
          }`}
        >
          <p className="text-sm font-semibold text-foreground">
            Free: Check your CBAM exposure in 60 seconds
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            No signup required — try IntelloCalc, our free public estimator.
          </p>
          <Link href="/intellocalc" className="mt-3 flex">
            <Button size="sm" className="h-8 w-full justify-center gap-1 rounded-[8px] px-2 text-xs">
              Try IntelloCalc
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </Card>
      </div>
    </>
  );
}
