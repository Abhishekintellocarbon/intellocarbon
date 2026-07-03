import { z } from "zod";

export const decideVerificationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], { message: "Decision must be approved or rejected" }),
  verifierOrg: z.string().trim().max(150).optional().or(z.literal("")),
  accreditationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  statement: z.string().trim().max(2000).optional().or(z.literal("")),
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type DecideVerificationInput = z.infer<typeof decideVerificationSchema>;
