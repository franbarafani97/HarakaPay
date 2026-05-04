import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { BillStatusSchema } from "@harakapay/shared";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const FiltersSchema = z.object({
  status: BillStatusSchema.optional(),
  vendorId: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
});

const HEADERS = [
  "Vendor",
  "Invoice #",
  "Amount (USD)",
  "Currency",
  "Issued",
  "Due",
  "Status",
  "Payment date",
  "Confirmation #",
  "Submitted by",
  "Approver",
  "Memo",
  "GL code",
  "Rejection reason",
];

function escapeCsv(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function humanStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get("/bills.csv", async (req, res) => {
  const filters = FiltersSchema.parse(req.query);

  const where: Prisma.BillWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.dueBefore || filters.dueAfter) {
    where.dueDate = {};
    if (filters.dueBefore) where.dueDate.lte = new Date(filters.dueBefore);
    if (filters.dueAfter) where.dueDate.gte = new Date(filters.dueAfter);
  }

  const bills = await prisma.bill.findMany({
    where,
    orderBy: { dueDate: "asc" },
    include: {
      vendor: { select: { name: true } },
      submittedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="bills-${today}.csv"`,
  );

  res.write(HEADERS.join(",") + "\n");
  for (const bill of bills) {
    const row = [
      bill.vendor?.name ?? "",
      bill.invoiceNumber,
      dollars(bill.amountCents),
      bill.currency,
      isoDate(bill.issueDate),
      isoDate(bill.dueDate),
      humanStatus(bill.status),
      isoDate(bill.paymentDate),
      bill.paymentConfirmation ?? "",
      bill.submittedBy?.name ?? "",
      bill.approvedBy?.name ?? "",
      bill.memo ?? "",
      bill.glCode ?? "",
      bill.rejectionReason ?? "",
    ];
    res.write(row.map(escapeCsv).join(",") + "\n");
  }
  res.end();
});
