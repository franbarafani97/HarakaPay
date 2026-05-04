import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { canTransition, type TransitionRequest } from "@harakapay/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import type { SessionPayload } from "../lib/jwt";

function generateConfirmation() {
  return "PAY-" + randomBytes(6).toString("hex").toUpperCase();
}

type ActivityType =
  | "submitted"
  | "approved"
  | "rejected"
  | "scheduled"
  | "paid"
  | "edited";

const billDetailInclude = {
  vendor: true,
  lineItems: true,
  activities: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.BillInclude;

export async function transitionBill(
  billId: string,
  request: TransitionRequest,
  user: SessionPayload,
) {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  if (!canTransition(bill.status, request.to, user.role)) {
    throw new ApiError(
      409,
      "STATE_TRANSITION_NOT_ALLOWED",
      `Cannot transition from ${bill.status} to ${request.to} as ${user.role}`,
      { from: bill.status, to: request.to, role: user.role },
    );
  }

  const updates: Prisma.BillUpdateInput = { status: request.to };
  const metadata: Record<string, unknown> = {
    fromStatus: bill.status,
    toStatus: request.to,
  };
  let activityType: ActivityType;

  switch (request.to) {
    case "pending_approval":
      activityType = "submitted";
      break;
    case "approved":
      updates.approvedBy = { connect: { id: user.userId } };
      activityType = "approved";
      break;
    case "rejected":
      updates.rejectionReason = request.rejectionReason;
      updates.approvedBy = { connect: { id: user.userId } };
      metadata.reason = request.rejectionReason;
      activityType = "rejected";
      break;
    case "scheduled": {
      updates.paymentDate = new Date(request.paymentDate);
      metadata.paymentDate = request.paymentDate;
      activityType = "scheduled";
      break;
    }
    case "paid": {
      const confirmation = generateConfirmation();
      updates.paymentConfirmation = confirmation;
      metadata.confirmation = confirmation;
      activityType = "paid";
      break;
    }
    case "draft":
      activityType = "edited";
      break;
  }

  return prisma.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        billId,
        userId: user.userId,
        type: activityType,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    return tx.bill.update({
      where: { id: billId },
      data: updates,
      include: billDetailInclude,
    });
  });
}

export type BulkTransitionResult = {
  id: string;
  success: boolean;
  error?: string;
};

export async function bulkTransition(
  billIds: string[],
  to: TransitionRequest["to"],
  user: SessionPayload,
): Promise<BulkTransitionResult[]> {
  const results: BulkTransitionResult[] = [];
  for (const id of billIds) {
    try {
      await transitionBill(id, { to } as TransitionRequest, user);
      results.push({ id, success: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ id, success: false, error: message });
    }
  }
  return results;
}
