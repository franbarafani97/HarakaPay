import { z } from "zod";

export const DashboardSummarySchema = z.object({
  needsMyApproval: z.number().int().nonnegative(),
  dueThisWeek: z.number().int().nonnegative(),
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
