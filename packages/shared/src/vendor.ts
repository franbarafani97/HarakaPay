import { z } from "zod";

export const PaymentMethodSchema = z.enum(["ach", "check", "wire"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  paymentMethod: PaymentMethodSchema,
  bankAccountLast4: z.string().nullable(),
  defaultGlCode: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Vendor = z.infer<typeof VendorSchema>;

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  paymentMethod: PaymentMethodSchema,
  bankAccountLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  defaultGlCode: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateVendor = z.infer<typeof CreateVendorSchema>;

export const UpdateVendorSchema = CreateVendorSchema.partial();
export type UpdateVendor = z.infer<typeof UpdateVendorSchema>;
