import { z } from "zod";

export const decideVerificationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], { message: "Decision must be approved or rejected" }),
  verifierOrg: z.string().trim().max(150).optional().or(z.literal("")),
  accreditationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  statement: z.string().trim().max(2000).optional().or(z.literal("")),
  qualifications: z.string().trim().max(2000).optional().or(z.literal("")),
  comments: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type DecideVerificationInput = z.infer<typeof decideVerificationSchema>;

export const updateChecklistSchema = z.object({
  checklistState: z.record(z.string(), z.boolean()),
});

export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

export const raiseQuerySchema = z.object({
  queryText: z.string().trim().min(1, "Enter the query text").max(2000),
});

export type RaiseQueryInput = z.infer<typeof raiseQuerySchema>;

export const respondQuerySchema = z.object({
  responseText: z.string().trim().min(1, "Enter your response").max(2000),
});

export type RespondQueryInput = z.infer<typeof respondQuerySchema>;
