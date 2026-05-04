import { z } from "zod";

export const PaidThisMonthSchema = z.object({
  count: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});

export const DashboardSummarySchema = z.object({
  needsMyApproval: z.number().int().nonnegative(),
  dueThisWeek: z.number().int().nonnegative(),
  scheduledThisWeek: z.number().int().nonnegative(),
  paidThisMonth: PaidThisMonthSchema,
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type PaidThisMonth = z.infer<typeof PaidThisMonthSchema>;
