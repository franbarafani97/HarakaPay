import { z } from "zod";

export const ExtractedFieldsSchema = z.object({
  invoiceNumber: z.string().nullable(),
  amountCents: z.number().int().nullable(),
  issueDate: z.string().datetime().nullable(),
  dueDate: z.string().datetime().nullable(),
});
export type ExtractedFields = z.infer<typeof ExtractedFieldsSchema>;

export const ScanSessionStatusSchema = z.enum([
  "pending",
  "uploaded",
  "processed",
  "failed",
]);
export type ScanSessionStatus = z.infer<typeof ScanSessionStatusSchema>;

export const ScanSessionEventSchema = z.object({
  status: ScanSessionStatusSchema,
  result: ExtractedFieldsSchema.nullable().optional(),
  error: z.string().optional(),
});
export type ScanSessionEvent = z.infer<typeof ScanSessionEventSchema>;
