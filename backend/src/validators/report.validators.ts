import { z } from "zod";

export const generateReportSchema = z.object({
  reportType: z.enum(["CBAM", "CCTS", "BRSR"], { message: "Select a valid report type" }),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
