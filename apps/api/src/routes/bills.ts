import { Router } from "express";
import {
  Prisma,
  type Bill,
  type LineItem,
  type Activity,
  type Vendor,
} from "@prisma/client";
import { BillFiltersSchema, CreateBillSchema } from "@harakapay/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { requireAuth } from "../middleware/auth";

type BillWithIncludes = Bill & {
  vendor?: { id: string; name: string } | Vendor | null;
  lineItems?: LineItem[];
  activities?: Activity[];
};

function publicBill(b: BillWithIncludes) {
  return {
    id: b.id,
    vendorId: b.vendorId,
    invoiceNumber: b.invoiceNumber,
    amountCents: b.amountCents,
    currency: b.currency,
    issueDate: b.issueDate.toISOString(),
    dueDate: b.dueDate.toISOString(),
    memo: b.memo,
    glCode: b.glCode,
    status: b.status,
    attachmentUrl: b.attachmentUrl,
    attachmentFilename: b.attachmentFilename,
    submittedById: b.submittedById,
    approvedById: b.approvedById,
    paymentDate: b.paymentDate?.toISOString() ?? null,
    paymentConfirmation: b.paymentConfirmation,
    rejectionReason: b.rejectionReason,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    ...(b.vendor && { vendor: { id: b.vendor.id, name: b.vendor.name } }),
    ...(b.lineItems && {
      lineItems: b.lineItems.map((li) => ({
        id: li.id,
        billId: li.billId,
        description: li.description,
        amountCents: li.amountCents,
        glCode: li.glCode,
      })),
    }),
    ...(b.activities && {
      activities: b.activities.map((a) => ({
        id: a.id,
        billId: a.billId,
        userId: a.userId,
        type: a.type,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
      })),
    }),
  };
}

function buildOrderBy(
  sort: string | undefined,
): Prisma.BillOrderByWithRelationInput[] {
  switch (sort) {
    case "-dueDate":
      return [{ dueDate: "desc" }, { id: "asc" }];
    case "amountCents":
      return [{ amountCents: "asc" }, { id: "asc" }];
    case "-amountCents":
      return [{ amountCents: "desc" }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "-createdAt":
      return [{ createdAt: "desc" }, { id: "asc" }];
    case "dueDate":
    default:
      return [{ dueDate: "asc" }, { id: "asc" }];
  }
}

export const billsRouter = Router();
billsRouter.use(requireAuth);

billsRouter.get("/", async (req, res) => {
  const filters = BillFiltersSchema.parse(req.query);
  const limit = filters.limit ?? 50;

  const where: Prisma.BillWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.dueBefore || filters.dueAfter) {
    where.dueDate = {};
    if (filters.dueBefore) where.dueDate.lte = new Date(filters.dueBefore);
    if (filters.dueAfter) where.dueDate.gte = new Date(filters.dueAfter);
  }
  if (filters.q?.length) {
    where.OR = [
      { invoiceNumber: { contains: filters.q, mode: "insensitive" } },
      { vendor: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const bills = await prisma.bill.findMany({
    where,
    orderBy: buildOrderBy(filters.sort),
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { vendor: { select: { id: true, name: true } } },
  });

  const hasMore = bills.length > limit;
  const page = hasMore ? bills.slice(0, limit) : bills;
  const nextCursor = hasMore ? page[page.length - 1]!.id : null;

  res.json({
    bills: page.map(publicBill),
    nextCursor,
  });
});

billsRouter.post("/", async (req, res) => {
  const data = CreateBillSchema.parse(req.body);

  const vendor = await prisma.vendor.findUnique({
    where: { id: data.vendorId },
  });
  if (!vendor) {
    throw new ApiError(400, "VENDOR_NOT_FOUND", "Vendor does not exist");
  }

  const bill = await prisma.bill.create({
    data: {
      vendorId: data.vendorId,
      invoiceNumber: data.invoiceNumber,
      amountCents: data.amountCents,
      issueDate: new Date(data.issueDate),
      dueDate: new Date(data.dueDate),
      memo: data.memo ?? null,
      glCode: data.glCode ?? null,
      submittedById: req.user!.userId,
      status: "draft",
      ...(data.lineItems && data.lineItems.length > 0
        ? {
            lineItems: {
              create: data.lineItems.map((li) => ({
                description: li.description,
                amountCents: li.amountCents,
                glCode: li.glCode ?? null,
              })),
            },
          }
        : {}),
      activities: {
        create: { type: "created", userId: req.user!.userId },
      },
    },
    include: {
      vendor: { select: { id: true, name: true } },
      lineItems: true,
      activities: true,
    },
  });

  res.status(201).json({ bill: publicBill(bill) });
});

billsRouter.get("/:id", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: true,
      lineItems: true,
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }
  res.json({ bill: publicBill(bill) });
});
