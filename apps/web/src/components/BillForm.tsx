import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCreateVendor, useVendor, useVendors } from "../hooks/useVendors";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Separator } from "./ui/separator";

type PaymentMethod = "ach" | "check" | "wire";

export type LineItemRow = {
  description: string;
  amountDollars: string;
  glCode: string;
};

export type BillFormValues = {
  vendorId: string;
  invoiceNumber: string;
  amountDollars: string;
  issueDate: string;
  dueDate: string;
  memo: string;
  glCode: string;
  lineItems: LineItemRow[];
};

export type BillFormPayload = {
  vendorId: string;
  invoiceNumber: string;
  amountCents: number;
  issueDate: string;
  dueDate: string;
  memo: string | undefined;
  glCode: string | undefined;
  lineItems: Array<{
    description: string;
    amountCents: number;
    glCode: string | undefined;
  }>;
  file: File | null;
};

export type BillFormProps = {
  initial: BillFormValues;
  initialAttachmentName?: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  uploadErrorMessage?: string;
  missingFields?: string[];
  onSubmit: (payload: BillFormPayload) => void;
};

const FIELD_LABELS: Record<string, string> = {
  invoiceNumber: "invoice number",
  amountDollars: "amount",
  issueDate: "issue date",
  dueDate: "due date",
};

function dateInputToISO(yyyymmdd: string): string {
  return new Date(`${yyyymmdd}T00:00:00.000Z`).toISOString();
}

function dollarsToCents(s: string): number {
  return Math.round(parseFloat(s) * 100);
}

export default function BillForm({
  initial,
  initialAttachmentName,
  submitLabel,
  pendingLabel,
  cancelHref,
  isPending,
  isError,
  errorMessage,
  uploadErrorMessage,
  missingFields,
  onSubmit,
}: BillFormProps) {
  const vendors = useVendors();
  const createVendor = useCreateVendor();

  const [form, setForm] = useState({
    vendorId: initial.vendorId,
    invoiceNumber: initial.invoiceNumber,
    amountDollars: initial.amountDollars,
    issueDate: initial.issueDate,
    dueDate: initial.dueDate,
    memo: initial.memo,
    glCode: initial.glCode,
  });
  const [lineItems, setLineItems] = useState<LineItemRow[]>(initial.lineItems);
  const [file, setFile] = useState<File | null>(null);
  const [showVendorForm, setShowVendorForm] = useState(false);

  const vendorDetail = useVendor(form.vendorId || undefined);

  useEffect(() => {
    const data = vendorDetail.data;
    if (!data) return;
    setForm((f) => ({
      ...f,
      glCode: f.glCode || (data.vendor.defaultGlCode ?? ""),
      amountDollars:
        f.amountDollars ||
        (data.stats.lastBillAmountCents != null
          ? (data.stats.lastBillAmountCents / 100).toFixed(2)
          : ""),
    }));
  }, [vendorDetail.data]);

  useEffect(() => {
    setForm({
      vendorId: initial.vendorId,
      invoiceNumber: initial.invoiceNumber,
      amountDollars: initial.amountDollars,
      issueDate: initial.issueDate,
      dueDate: initial.dueDate,
      memo: initial.memo,
      glCode: initial.glCode,
    });
    setLineItems(initial.lineItems);
  }, [initial]);
  const [newVendor, setNewVendor] = useState<{
    name: string;
    email: string;
    paymentMethod: PaymentMethod;
  }>({ name: "", email: "", paymentMethod: "ach" });

  async function onAddVendor() {
    const created = await createVendor.mutateAsync({
      name: newVendor.name,
      email: newVendor.email || undefined,
      paymentMethod: newVendor.paymentMethod,
    });
    setForm((f) => ({ ...f, vendorId: created.id }));
    setNewVendor({ name: "", email: "", paymentMethod: "ach" });
    setShowVendorForm(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.vendorId) return;
    onSubmit({
      vendorId: form.vendorId,
      invoiceNumber: form.invoiceNumber,
      amountCents: dollarsToCents(form.amountDollars),
      issueDate: dateInputToISO(form.issueDate),
      dueDate: dateInputToISO(form.dueDate),
      memo: form.memo || undefined,
      glCode: form.glCode || undefined,
      lineItems: lineItems.map((li) => ({
        description: li.description,
        amountCents: dollarsToCents(li.amountDollars),
        glCode: li.glCode || undefined,
      })),
      file,
    });
  }

  function addLineItem() {
    setLineItems((items) => [
      ...items,
      { description: "", amountDollars: "", glCode: "" },
    ]);
  }
  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }
  function updateLineItem(
    index: number,
    field: keyof LineItemRow,
    value: string,
  ) {
    setLineItems((items) =>
      items.map((li, i) => (i === index ? { ...li, [field]: value } : li)),
    );
  }

  const submitting = isPending || createVendor.isPending;

  const missing = new Set(missingFields ?? []);
  const hasMissing = missing.size > 0;

  return (
    <form onSubmit={handleSubmit}>
      {hasMissing && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">
            Review extracted fields
          </p>
          <p className="mt-1 text-destructive/90">
            We couldn't extract:{" "}
            {Array.from(missing)
              .map((f) => FIELD_LABELS[f] ?? f)
              .join(", ")}
            . Please fill them in.
          </p>
        </div>
      )}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="vendor">Vendor</Label>
            <div className="flex gap-2">
              <Select
                value={form.vendorId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, vendorId: v ?? "" }))
                }
              >
                <SelectTrigger id="vendor" className="flex-1">
                  <SelectValue placeholder="Select a vendor…">
                    {(value) =>
                      vendors.data?.find((vendor) => vendor.id === value)
                        ?.name ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {vendors.data?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowVendorForm((s) => !s)}
              >
                {showVendorForm ? "Cancel" : "+ New"}
              </Button>
            </div>

            {showVendorForm && (
              <Card className="mt-3">
                <CardContent className="pt-6 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-name">Vendor name</Label>
                    <Input
                      id="vendor-name"
                      value={newVendor.name}
                      onChange={(e) =>
                        setNewVendor((v) => ({ ...v, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-email">Email</Label>
                    <Input
                      id="vendor-email"
                      type="email"
                      value={newVendor.email}
                      onChange={(e) =>
                        setNewVendor((v) => ({ ...v, email: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vendor-method">Payment method</Label>
                    <Select
                      value={newVendor.paymentMethod}
                      onValueChange={(v) =>
                        setNewVendor((nv) => ({
                          ...nv,
                          paymentMethod: (v ?? "ach") as PaymentMethod,
                        }))
                      }
                    >
                      <SelectTrigger id="vendor-method">
                        <SelectValue>
                          {(value) =>
                            value === "ach"
                              ? "ACH"
                              : value === "check"
                                ? "Check"
                                : value === "wire"
                                  ? "Wire"
                                  : value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ach">ACH</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="wire">Wire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    onClick={onAddVendor}
                    disabled={!newVendor.name || createVendor.isPending}
                    className="w-full"
                  >
                    {createVendor.isPending ? "Adding…" : "Add vendor"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-number">Invoice number</Label>
              <Input
                id="invoice-number"
                value={form.invoiceNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
                }
                aria-invalid={missing.has("invoiceNumber") || undefined}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="pl-7 tabular-nums"
                  value={form.amountDollars}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amountDollars: e.target.value }))
                  }
                  aria-invalid={missing.has("amountDollars") || undefined}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-date">Issue date</Label>
              <Input
                id="issue-date"
                type="date"
                value={form.issueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issueDate: e.target.value }))
                }
                aria-invalid={missing.has("issueDate") || undefined}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                aria-invalid={missing.has("dueDate") || undefined}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="memo">Memo</Label>
              <Input
                id="memo"
                value={form.memo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, memo: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gl-code">GL code</Label>
              <Input
                id="gl-code"
                value={form.glCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, glCode: e.target.value }))
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items (optional)</Label>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs text-primary hover:underline"
              >
                + Add line item
              </button>
            </div>
            {lineItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Use line items to break a bill into rows. They don't have to sum
                to the total.
              </p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((li, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) =>
                        updateLineItem(i, "description", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={li.amountDollars}
                      onChange={(e) =>
                        updateLineItem(i, "amountDollars", e.target.value)
                      }
                      className="w-32 tabular-nums"
                    />
                    <Input
                      placeholder="GL"
                      value={li.glCode}
                      onChange={(e) =>
                        updateLineItem(i, "glCode", e.target.value)
                      }
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(i)}
                      aria-label="Remove line item"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="file">PDF attachment (optional)</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:text-secondary-foreground file:font-medium hover:file:bg-secondary/80"
            />
            {initialAttachmentName && !file && (
              <p className="text-xs text-muted-foreground">
                Current: {initialAttachmentName}. Choose a file to replace it.
              </p>
            )}
          </div>

          {isError && (
            <p className="text-sm text-destructive">
              {errorMessage ??
                "Could not save. Check the fields and try again."}
            </p>
          )}
          {uploadErrorMessage && (
            <p className="text-sm text-destructive">{uploadErrorMessage}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 mt-6">
        <Link
          to={cancelHref}
          className={buttonVariants({ variant: "outline" })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={submitting || !form.vendorId}>
          {submitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
