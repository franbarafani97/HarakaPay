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

  const [needsMyApproval, dueThisWeek] = await Promise.all([
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
  ]);

  res.json({ needsMyApproval, dueThisWeek });
});
