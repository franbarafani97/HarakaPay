import { z } from "zod";

export const BillStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "paid",
  "rejected",
]);
export type BillStatus = z.infer<typeof BillStatusSchema>;

export const LineItemSchema = z.object({
  id: z.string(),
  billId: z.string(),
  description: z.string(),
  amountCents: z.number().int(),
  glCode: z.string().nullable(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const CreateLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  amountCents: z.number().int(),
  glCode: z.string().max(50).optional(),
});
export type CreateLineItem = z.infer<typeof CreateLineItemSchema>;

export const BillSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  invoiceNumber: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  memo: z.string().nullable(),
  glCode: z.string().nullable(),
  status: BillStatusSchema,
  attachmentUrl: z.string().nullable(),
  attachmentFilename: z.string().nullable(),
  submittedById: z.string().nullable(),
  approvedById: z.string().nullable(),
  paymentDate: z.string().datetime().nullable(),
  paymentConfirmation: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lineItems: z.array(LineItemSchema).optional(),
});
export type Bill = z.infer<typeof BillSchema>;

export const CreateBillSchema = z.object({
  vendorId: z.string().min(1),
  invoiceNumber: z.string().min(1).max(100),
  amountCents: z.number().int().positive(),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  memo: z.string().max(2000).optional(),
  glCode: z.string().max(50).optional(),
  lineItems: z.array(CreateLineItemSchema).optional(),
});
export type CreateBill = z.infer<typeof CreateBillSchema>;

export const UpdateBillSchema = CreateBillSchema.partial();
export type UpdateBill = z.infer<typeof UpdateBillSchema>;

export const TransitionRequestSchema = z.discriminatedUnion("to", [
  z.object({ to: z.literal("pending_approval") }),
  z.object({ to: z.literal("approved") }),
  z.object({
    to: z.literal("rejected"),
    rejectionReason: z.string().min(1).max(1000),
  }),
  z.object({ to: z.literal("scheduled"), paymentDate: z.string().datetime() }),
  z.object({ to: z.literal("paid") }),
  z.object({ to: z.literal("draft") }),
]);
export type TransitionRequest = z.infer<typeof TransitionRequestSchema>;

export const BulkTransitionRequestSchema = z.object({
  billIds: z.array(z.string()).min(1).max(100),
  to: BillStatusSchema,
});
export type BulkTransitionRequest = z.infer<typeof BulkTransitionRequestSchema>;

export const BillFiltersSchema = z.object({
  status: BillStatusSchema.optional(),
  vendorId: z.string().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  q: z.string().optional(),
  sort: z
    .enum([
      "dueDate",
      "-dueDate",
      "amountCents",
      "-amountCents",
      "createdAt",
      "-createdAt",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});
export type BillFilters = z.infer<typeof BillFiltersSchema>;
