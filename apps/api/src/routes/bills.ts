import { Router } from "express";
import {
  Prisma,
  type Bill,
  type LineItem,
  type Activity,
  type Vendor,
} from "@prisma/client";
import {
  BillFiltersSchema,
  BulkTransitionRequestSchema,
  CreateBillSchema,
  TransitionRequestSchema,
  UpdateBillSchema,
} from "@harakapay/shared";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { requireAuth } from "../middleware/auth";
import { uploadPdf, UPLOADS_PATH } from "../middleware/upload";
import { bulkTransition, transitionBill } from "../services/state-machine";

type BillWithIncludes = Bill & {
  vendor?: { id: string; name: string } | Vendor | null;
  submittedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  lineItems?: LineItem[];
  activities?: (Activity & {
    user?: { id: string; name: string } | null;
  })[];
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
    ...(b.submittedBy != null && {
      submittedBy: { id: b.submittedBy.id, name: b.submittedBy.name },
    }),
    ...(b.approvedBy != null && {
      approvedBy: { id: b.approvedBy.id, name: b.approvedBy.name },
    }),
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
        user: a.user ? { id: a.user.id, name: a.user.name } : null,
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

billsRouter.post("/bulk-transition", async (req, res) => {
  const { billIds, to } = BulkTransitionRequestSchema.parse(req.body);
  if (to !== "approved") {
    throw new ApiError(
      400,
      "BULK_NOT_SUPPORTED",
      "Bulk transitions only support 'approved'",
    );
  }
  const results = await bulkTransition(billIds, "approved", req.user!);
  res.json({ results });
});

billsRouter.post("/:id/transition", async (req, res) => {
  const request = TransitionRequestSchema.parse(req.body);
  const bill = await transitionBill(req.params.id, request, req.user!);
  res.json({ bill: publicBill(bill) });
});

billsRouter.post("/:id/attachment", uploadPdf, async (req, res) => {
  const billId = String(req.params.id);
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) {
    await fs.promises
      .unlink(path.join(UPLOADS_PATH, `${billId}.pdf`))
      .catch(() => {});
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  const updated = await prisma.bill.update({
    where: { id: billId },
    data: {
      attachmentUrl: `/api/v1/bills/${billId}/attachment`,
      attachmentFilename: req.file!.originalname,
    },
    include: {
      vendor: true,
      lineItems: true,
      activities: { orderBy: { createdAt: "asc" } },
    },
  });

  res.json({ bill: publicBill(updated) });
});

billsRouter.get("/:id/attachment", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.id },
  });
  if (!bill || !bill.attachmentFilename) {
    throw new ApiError(
      404,
      "ATTACHMENT_NOT_FOUND",
      "No attachment for this bill",
    );
  }

  const filePath = path.join(UPLOADS_PATH, `${bill.id}.pdf`);
  if (!fs.existsSync(filePath)) {
    throw new ApiError(
      404,
      "ATTACHMENT_NOT_FOUND",
      "Attachment file is missing on disk",
    );
  }

  const safeName = bill.attachmentFilename.replace(/"/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  fs.createReadStream(filePath).pipe(res);
});

billsRouter.get("/:id", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.id },
    include: {
      vendor: true,
      submittedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      lineItems: true,
      activities: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }
  res.json({ bill: publicBill(bill) });
});

billsRouter.patch("/:id", async (req, res) => {
  const data = UpdateBillSchema.parse(req.body);

  const existing = await prisma.bill.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  if (existing.status !== "draft" && existing.status !== "rejected") {
    throw new ApiError(
      409,
      "BILL_NOT_EDITABLE",
      `Cannot edit bill in status ${existing.status}`,
      { status: existing.status },
    );
  }

  if (data.vendorId && data.vendorId !== existing.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: data.vendorId },
    });
    if (!vendor) {
      throw new ApiError(400, "VENDOR_NOT_FOUND", "Vendor does not exist");
    }
  }

  const bill = await prisma.$transaction(async (tx) => {
    if (data.lineItems !== undefined) {
      await tx.lineItem.deleteMany({ where: { billId: req.params.id } });
      if (data.lineItems.length > 0) {
        await tx.lineItem.createMany({
          data: data.lineItems.map((li) => ({
            billId: req.params.id,
            description: li.description,
            amountCents: li.amountCents,
            glCode: li.glCode ?? null,
          })),
        });
      }
    }

    await tx.activity.create({
      data: {
        billId: req.params.id,
        userId: req.user!.userId,
        type: "edited",
      },
    });

    return tx.bill.update({
      where: { id: req.params.id },
      data: {
        ...(data.vendorId !== undefined && { vendorId: data.vendorId }),
        ...(data.invoiceNumber !== undefined && {
          invoiceNumber: data.invoiceNumber,
        }),
        ...(data.amountCents !== undefined && {
          amountCents: data.amountCents,
        }),
        ...(data.issueDate !== undefined && {
          issueDate: new Date(data.issueDate),
        }),
        ...(data.dueDate !== undefined && {
          dueDate: new Date(data.dueDate),
        }),
        ...(data.memo !== undefined && { memo: data.memo }),
        ...(data.glCode !== undefined && { glCode: data.glCode }),
      },
      include: {
        vendor: true,
        lineItems: true,
        activities: { orderBy: { createdAt: "asc" } },
      },
    });
  });

  res.json({ bill: publicBill(bill) });
});

billsRouter.delete("/:id", async (req, res) => {
  const bill = await prisma.bill.findUnique({
    where: { id: req.params.id },
  });
  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  if (bill.status !== "draft") {
    throw new ApiError(
      409,
      "BILL_NOT_DELETABLE",
      `Cannot delete bill in status ${bill.status}`,
      { status: bill.status },
    );
  }

  if (bill.submittedById !== req.user!.userId) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only the submitter can delete this bill",
    );
  }

  await prisma.bill.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
