import { z } from "zod";

// Must stay in step with REPORT_TYPES in reportGeneration.service.ts, which is
// what decides the cards a facility is offered. UK_CBAM was missing here while
// the service supported it and the UI rendered a "UK CBAM Return" card, so
// clicking that card returned 400 "Select a valid report type" for every user
// in UK scope.
//
// GRI and CSRD are deliberately absent. The dispatch behind this endpoint now
// builds them correctly, but they are produced and downloaded from their own
// ESG endpoints, which stream the PDF rather than storing a Report row.
// Admitting them here would create a second, divergent way to generate the
// same document — a product decision, not a validation fix.
export const generateReportSchema = z.object({
  reportType: z.enum(["CBAM", "UK_CBAM", "CCTS", "BRSR"], { message: "Select a valid report type" }),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
