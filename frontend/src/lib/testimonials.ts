/**
 * Client testimonials for the homepage social-proof section.
 *
 * ⚠️ PLACEHOLDER — INTENTIONALLY EMPTY. DO NOT ADD INVENTED ENTRIES.
 *
 * This array ships empty on purpose. Intellocarbon is a regulatory compliance
 * platform, and a fabricated quote — even an obviously generic one, even
 * attributed to an unnamed "leading steel exporter" — is a misrepresentation
 * to prospective clients who are choosing a vendor for a legal filing. While
 * the array is empty the section renders a factual capability statement
 * instead (see testimonials-section.tsx); it makes no claim about who uses the
 * product.
 *
 * TO ADD A REAL TESTIMONIAL, every one of these must hold:
 *   1. The client has actually used the platform.
 *   2. They have given written permission to be quoted and named.
 *   3. The quote is their words, not a rewrite.
 *   4. Any number in the quote (tonnes, euros, hours saved) is one they
 *      stated and can substantiate.
 * Adding one entry switches the section from the capability statement to the
 * carousel automatically — no component change needed.
 *
 * Shape to copy:
 *
 *   {
 *     id: "acme-steel-2026",
 *     quote: "Their exact words, unedited.",
 *     name: "Full Name",
 *     title: "Head of Sustainability",
 *     company: "Company Name",
 *     logoSrc: "/logos/company.svg", // optional, put the file in /public
 *     logoAlt: "Company Name logo",  // required whenever logoSrc is set
 *   }
 */

export interface Testimonial {
  /** Stable key for React and for referencing a specific approval on file. */
  id: string;
  /** The client's own words. Never paraphrased or written on their behalf. */
  quote: string;
  name: string;
  /** Role at the company, e.g. "Head of Sustainability". */
  title: string;
  company: string;
  /** Optional logo, served from /public. */
  logoSrc?: string;
  /** Alt text — required whenever logoSrc is set, so the logo isn't unlabelled. */
  logoAlt?: string;
}

export const TESTIMONIALS: Testimonial[] = [];

/**
 * Sectors the calculation engine actually supports — this is the Sector enum
 * in prisma/schema.prisma, not a marketing list. Used by the capability
 * statement that stands in for testimonials, so the fallback states something
 * verifiable from the product rather than implying a customer base.
 */
export const SUPPORTED_SECTORS = [
  "Steel",
  "Cement",
  "Aluminium",
  "Fertilizer",
  "Hydrogen",
  "Power",
] as const;
