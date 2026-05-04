import { Router } from "express";
import { z } from "zod";
import type { Vendor } from "@prisma/client";
import { CreateVendorSchema, UpdateVendorSchema } from "@harakapay/shared";
import { prisma } from "../lib/prisma";
import { ApiError } from "../lib/api-error";
import { requireAuth } from "../middleware/auth";

const ListQuerySchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

function publicVendor(v: Vendor) {
  return {
    id: v.id,
    name: v.name,
    email: v.email,
    paymentMethod: v.paymentMethod,
    bankAccountLast4: v.bankAccountLast4,
    defaultGlCode: v.defaultGlCode,
    notes: v.notes,
    createdAt: v.createdAt.toISOString(),
  };
}

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth);

vendorsRouter.get("/", async (req, res) => {
  const { q, limit, cursor } = ListQuerySchema.parse(req.query);

  const vendors = await prisma.vendor.findMany({
    where: q?.length
      ? { name: { contains: q, mode: "insensitive" } }
      : undefined,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = vendors.length > limit;
  const page = hasMore ? vendors.slice(0, limit) : vendors;
  const nextCursor = hasMore ? page[page.length - 1]!.id : null;

  res.json({
    vendors: page.map(publicVendor),
    nextCursor,
  });
});

vendorsRouter.post("/", async (req, res) => {
  const data = CreateVendorSchema.parse(req.body);
  const vendor = await prisma.vendor.create({ data });
  res.status(201).json({ vendor: publicVendor(vendor) });
});

vendorsRouter.get("/:id", async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.params.id },
  });
  if (!vendor) {
    throw new ApiError(404, "VENDOR_NOT_FOUND", "Vendor not found");
  }

  const [paidAgg, lastPaid, openBillCount] = await Promise.all([
    prisma.bill.aggregate({
      where: { vendorId: vendor.id, status: "paid" },
      _sum: { amountCents: true },
    }),
    prisma.bill.findFirst({
      where: { vendorId: vendor.id, status: "paid" },
      orderBy: { paymentDate: "desc" },
      select: { paymentDate: true },
    }),
    prisma.bill.count({
      where: {
        vendorId: vendor.id,
        status: { notIn: ["paid", "rejected"] },
      },
    }),
  ]);

  res.json({
    vendor: publicVendor(vendor),
    stats: {
      totalSpentCents: paidAgg._sum.amountCents ?? 0,
      lastPaidAt: lastPaid?.paymentDate?.toISOString() ?? null,
      openBillCount,
    },
  });
});

vendorsRouter.patch("/:id", async (req, res) => {
  const data = UpdateVendorSchema.parse(req.body);

  const existing = await prisma.vendor.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) {
    throw new ApiError(404, "VENDOR_NOT_FOUND", "Vendor not found");
  }

  const vendor = await prisma.vendor.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ vendor: publicVendor(vendor) });
});
