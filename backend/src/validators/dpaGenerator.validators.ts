import { z } from "zod";

export const generateDpaSchema = z.object({
  customerCompanyName: z.string().trim().min(1, "Customer company name is required"),
  signingDate: z.coerce.date(),
  signatoryName: z.string().trim().min(1, "Signatory name is required"),
  signatoryDesignation: z.string().trim().min(1, "Signatory designation is required"),
});
export type GenerateDpaInput = z.infer<typeof generateDpaSchema>;
