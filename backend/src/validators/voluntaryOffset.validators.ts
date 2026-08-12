import { z } from "zod";
import { OffsetCategory, OffsetRegistry } from "@prisma/client";

/**
 * Format checks only.
 *
 * This module is a tracking log: Intellocarbon does not verify, rate or issue
 * carbon credits, so nothing here asserts that a credit exists, that a serial
 * is well-formed for its registry, or that a vintage is "good". The rules
 * below reject only inputs that could not be a record of anything — a
 * non-positive tonnage, a year outside any plausible crediting period, an
 * empty serial. Everything else is stored exactly as entered.
 *
 * One strict schema covers both draft and submit saves, as in
 * scope3.validators.ts: a purchase has no meaningful half-filled state (all
 * six fields come off a single retirement certificate), so the DRAFT/SUBMITTED
 * distinction lives in the `status` column set by the service, not in how
 * strictly the input is checked.
 */

// The first CDM/voluntary-market vintages date from the early 2000s; the upper
// bound allows forward-dated vintages a purchaser may legitimately hold.
const EARLIEST_VINTAGE_YEAR = 1990;
const LATEST_VINTAGE_YEAR = 2100;

export const voluntaryOffsetSchema = z.object({
  registry: z.nativeEnum(OffsetRegistry, { errorMap: () => ({ message: "Select a registry" }) }),
  creditSerialNumber: z
    .string()
    .trim()
    .min(1, "Enter the credit serial number")
    // Generous: serial formats differ per registry and change over time, so
    // this bounds storage rather than asserting a shape.
    .max(200, "Serial number is too long"),
  tonnageTco2e: z.coerce.number().positive("Enter a tonnage greater than 0"),
  category: z.nativeEnum(OffsetCategory, { errorMap: () => ({ message: "Select a category" }) }),
  vintageYear: z.coerce
    .number()
    .int("Vintage year must be a whole year")
    .min(EARLIEST_VINTAGE_YEAR, `Vintage year must be ${EARLIEST_VINTAGE_YEAR} or later`)
    .max(LATEST_VINTAGE_YEAR, `Vintage year must be ${LATEST_VINTAGE_YEAR} or earlier`),
  purchaseDate: z.coerce.date({ errorMap: () => ({ message: "Select a purchase date" }) }),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type VoluntaryOffsetInput = z.infer<typeof voluntaryOffsetSchema>;
