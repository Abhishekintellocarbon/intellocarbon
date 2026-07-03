import { TrustStrip } from "./trust-strip";

export function ToolHero({
  eyebrow,
  title,
  tagline,
  heroText,
}: {
  eyebrow: string;
  title: string;
  tagline: string;
  heroText: string;
}) {
  return (
    <section className="bg-gradient-teal-blue">
      <div className="mx-auto max-w-5xl px-6 py-14 text-center text-[#06120F]">
        <span className="inline-flex items-center rounded-full bg-[#06120F]/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide">
          {eyebrow}
        </span>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-base font-medium opacity-80 sm:text-lg">{tagline}</p>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-sm opacity-90 sm:text-base">{heroText}</p>
        <TrustStrip className="mt-8 text-[#06120F]/80" />
      </div>
    </section>
  );
}
