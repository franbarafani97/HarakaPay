import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/summary", async (req, res) => {
  const user = req.user!;
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + ONE_WEEK_MS);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [needsMyApproval, dueThisWeek, scheduledThisWeek, paidAgg] =
    await Promise.all([
      prisma.bill.count({
        where: {
          status: "pending_approval",
          ...(user.role === "submitter" ? { submittedById: user.userId } : {}),
        },
      }),
      prisma.bill.count({
        where: {
          dueDate: { gte: now, lte: inOneWeek },
          status: { notIn: ["paid", "rejected"] },
        },
      }),
      prisma.bill.count({
        where: {
          status: "scheduled",
          paymentDate: { gte: now, lte: inOneWeek },
        },
      }),
      prisma.bill.aggregate({
        where: {
          status: "paid",
          paymentDate: { gte: startOfMonth },
        },
        _count: true,
        _sum: { amountCents: true },
      }),
    ]);

  res.json({
    needsMyApproval,
    dueThisWeek,
    scheduledThisWeek,
    paidThisMonth: {
      count: paidAgg._count,
      totalCents: paidAgg._sum.amountCents ?? 0,
    },
  });
});
