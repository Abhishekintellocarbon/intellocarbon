import { z } from "zod";

/**
 * Client-side validation for the CDP module.
 *
 * Deliberately thin. The API's schemas are authoritative and are generated
 * from the questionnaire registry, so duplicating per-question rules here
 * would be a second registry to keep in step. What lives here is only what
 * the user needs told before a request is worth making: the reporting period
 * format, checked before the form is even opened.
 *
 * The repeating blocks' completeness rules are the other client-side check,
 * and they live next to the row types in components/cdp/cdp-repeating-blocks
 * so the "not saved yet" hint and the payload filter cannot disagree.
 */
export const cdpReportingPeriodSchema = z
  .string()
  .trim()
  .regex(/^FY\d{4}-\d{2}$/, 'Use the format "FY2025-26"');
