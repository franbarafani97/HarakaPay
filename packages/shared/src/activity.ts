import { z } from "zod";

export const ActivityTypeSchema = z.enum([
  "created",
  "edited",
  "submitted",
  "approved",
  "rejected",
  "scheduled",
  "paid",
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  billId: z.string(),
  userId: z.string().nullable(),
  type: ActivityTypeSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
});
export type Activity = z.infer<typeof ActivitySchema>;
