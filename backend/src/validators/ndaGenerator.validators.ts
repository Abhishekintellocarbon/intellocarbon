import { z } from "zod";

export const generateNdaSchema = z.object({
  recipientName: z.string().trim().min(1, "Recipient name is required"),
  recipientType: z.enum(["INDIVIDUAL", "COMPANY"]),
  recipientAddress: z.string().trim().min(1, "Recipient address is required"),
  effectiveDate: z.coerce.date(),
});
export type GenerateNdaInput = z.infer<typeof generateNdaSchema>;
