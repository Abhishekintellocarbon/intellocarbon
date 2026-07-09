import { z } from "zod";

export const upsertCrossCheckReviewSchema = z
  .object({
    status: z.enum(["MATCHED", "MISMATCH"]),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.status !== "MISMATCH" || (data.notes && data.notes.length > 0), {
    message: "Notes are required when flagging a mismatch",
    path: ["notes"],
  });

export type UpsertCrossCheckReviewInput = z.infer<typeof upsertCrossCheckReviewSchema>;
