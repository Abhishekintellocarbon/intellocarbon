"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Quote, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SUPPORTED_SECTORS, TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

/**
 * Homepage social proof.
 *
 * Two states, chosen by whether TESTIMONIALS has entries:
 *  - empty (today) — a capability statement that claims nothing about who
 *    uses the product. See the warning in lib/testimonials.ts.
 *  - populated — the carousel below, with no other change needed.
 *
 * The carousel is a native scroll-snap track rather than a JS slider: touch,
 * trackpad and keyboard scrolling all work for free, it cannot desync from
 * what's on screen, and it degrades to a plain scroller if JS hasn't hydrated.
 * Auto-advance is layered on top and yields to the user rather than fighting
 * them.
 */

const AUTO_ADVANCE_MS = 6000;

/**
 * Watched by the site-wide "Free Tools" FAB (IntelloCalcToolsPanel), which
 * hides while this section is in view. The FAB is fixed to the bottom-right on
 * mobile and would otherwise sit on top of a card's lower-right corner —
 * exactly the collision the inline IntelloCalc CTA already avoids this way.
 *
 * Exported rather than duplicated as a string literal so the section and the
 * FAB cannot drift apart.
 */
export const SOCIAL_PROOF_SECTION_ID = "social-proof";

export function TestimonialsSection() {
  if (TESTIMONIALS.length === 0) {
    return <CapabilityStatement />;
  }
  return <TestimonialCarousel testimonials={TESTIMONIALS} />;
}

// ---------------------------------------------------------------------------
// Empty state — no testimonials yet
// ---------------------------------------------------------------------------

/**
 * Deliberately says what the platform covers, not who uses it. Every claim
 * here is checkable against the product: the sector list is the Sector enum,
 * and the frameworks are the ones with an implemented report builder.
 */
function CapabilityStatement() {
  return (
    <section id={SOCIAL_PROOF_SECTION_ID} className="relative z-10 mx-auto max-w-6xl px-6 pb-20 text-center">
      <h2 className="text-[28px] font-semibold sm:text-[32px]">Built for India&apos;s obligated exporters</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
        The calculation engine covers the sectors that carry CBAM and CCTS obligations — with the same activity
        data driving your EU communication package, your BEE filing, and your BRSR Core disclosure.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        {SUPPORTED_SECTORS.map((sector) => (
          <span
            key={sector}
            className="rounded-full border border-surface-border bg-surface px-4 py-1.5 text-sm text-foreground/90"
          >
            {sector}
          </span>
        ))}
      </div>

      <Card className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 p-7 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border bg-surface-raised">
          <ShieldCheck className="h-4 w-4 text-teal-500" />
        </span>
        <p className="text-sm text-muted-foreground">
          Every figure the platform produces cites the regulation or annex it comes from — no assumed values, no
          unsourced defaults. That is the standard your verifier will hold the report to, so it is the standard the
          calculation is built to.
        </p>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Carousel — used once real testimonials exist
// ---------------------------------------------------------------------------

function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Any deliberate interaction stops the rotation for the rest of the visit —
  // a card sliding away mid-sentence because a timer fired is worse than a
  // carousel that simply stopped.
  const [paused, setPaused] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[index] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  // Derive the active dot from actual scroll position rather than tracking it
  // separately, so a swipe, a trackpad flick and the arrows can't disagree.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const children = Array.from(track.children) as HTMLElement[];
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0;
        let nearestDistance = Infinity;
        children.forEach((child, i) => {
          const childCenter = child.offsetLeft - track.offsetLeft + child.clientWidth / 2;
          const distance = Math.abs(childCenter - center);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = i;
          }
        });
        setActiveIndex(nearest);
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (paused || testimonials.length < 2) return;
    // Honour the OS "reduce motion" setting — auto-sliding content is exactly
    // what that preference exists to suppress.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % testimonials.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [paused, testimonials.length, scrollToIndex]);

  const step = (delta: number) => {
    setPaused(true);
    const next = Math.min(testimonials.length - 1, Math.max(0, activeIndex + delta));
    scrollToIndex(next);
  };

  return (
    <section
      id={SOCIAL_PROOF_SECTION_ID}
      className="relative z-10 mx-auto max-w-6xl px-6 pb-20"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
      onMouseEnter={() => setPaused(true)}
      onFocusCapture={() => setPaused(true)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="flex flex-wrap items-end justify-between gap-4 text-center sm:text-left">
        <h2 className="w-full text-[28px] font-semibold sm:w-auto sm:text-[32px]">What our clients say</h2>

        {testimonials.length > 1 && (
          <div className="mx-auto flex gap-2 sm:mx-0">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={activeIndex === 0}
              aria-label="Previous testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-muted transition-colors hover:border-teal-500/40 hover:text-teal-500 disabled:opacity-40 disabled:hover:border-surface-border disabled:hover:text-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={activeIndex === testimonials.length - 1}
              aria-label="Next testimonial"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-muted transition-colors hover:border-teal-500/40 hover:text-teal-500 disabled:opacity-40 disabled:hover:border-surface-border disabled:hover:text-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/*
        -mx-6 px-6 lets cards bleed to the viewport edge on mobile while the
        first one still lines up with the page gutter. no-scrollbar hides the
        bar without disabling the scrolling itself.
      */}
      <div
        ref={trackRef}
        className="no-scrollbar mt-8 -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-2"
        tabIndex={0}
        aria-live="off"
      >
        {testimonials.map((testimonial, index) => (
          <Card
            key={testimonial.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${testimonials.length}`}
            className="flex w-[85vw] max-w-md shrink-0 snap-start flex-col p-7 sm:w-[420px]"
          >
            <Quote className="h-5 w-5 shrink-0 text-teal-500" aria-hidden />
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>

            <figcaption className="mt-6 flex items-center gap-3 border-t border-surface-border pt-5">
              {testimonial.logoSrc && (
                <Image
                  src={testimonial.logoSrc}
                  alt={testimonial.logoAlt ?? `${testimonial.company} logo`}
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-lg object-contain"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{testimonial.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {testimonial.title}, {testimonial.company}
                </p>
              </div>
            </figcaption>
          </Card>
        ))}
      </div>

      {testimonials.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.id}
              type="button"
              onClick={() => {
                setPaused(true);
                scrollToIndex(index);
              }}
              aria-label={`Go to testimonial ${index + 1}`}
              aria-current={index === activeIndex}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === activeIndex ? "w-6 bg-teal-500" : "w-1.5 bg-surface-border hover:bg-muted",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
