import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useCreateVendor, useVendors } from "../hooks/useVendors";
import { useCreateBill, useUploadAttachment } from "../hooks/useBills";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";

type PaymentMethod = "ach" | "check" | "wire";

type LineItemRow = {
  description: string;
  amountDollars: string;
  glCode: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDaysISO(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

function dateInputToISO(yyyymmdd: string): string {
  return new Date(`${yyyymmdd}T00:00:00.000Z`).toISOString();
}

function dollarsToCents(s: string): number {
  return Math.round(parseFloat(s) * 100);
}

export default function NewBill() {
  const navigate = useNavigate();
  const vendors = useVendors();
  const createBill = useCreateBill();
  const uploadAttachment = useUploadAttachment();
  const createVendor = useCreateVendor();

  const [form, setForm] = useState({
    vendorId: "",
    invoiceNumber: "",
    amountDollars: "",
    issueDate: todayISO(),
    dueDate: inDaysISO(30),
    memo: "",
    glCode: "",
  });
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [showVendorForm, setShowVendorForm] = useState(false);
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.vendorId) return;

    const payload = {
      vendorId: form.vendorId,
      invoiceNumber: form.invoiceNumber,
      amountCents: dollarsToCents(form.amountDollars),
      issueDate: dateInputToISO(form.issueDate),
      dueDate: dateInputToISO(form.dueDate),
      memo: form.memo || undefined,
      glCode: form.glCode || undefined,
      lineItems:
        lineItems.length > 0
          ? lineItems.map((li) => ({
              description: li.description,
              amountCents: dollarsToCents(li.amountDollars),
              glCode: li.glCode || undefined,
            }))
          : undefined,
    };

    const bill = await createBill.mutateAsync(payload);
    if (file) {
      await uploadAttachment.mutateAsync({ billId: bill.id, file });
    }
    navigate(`/bills/${bill.id}`);
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

  const submitting =
    createBill.isPending ||
    uploadAttachment.isPending ||
    createVendor.isPending;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-2xl px-6 py-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-6">New bill</h2>

        <form onSubmit={onSubmit}>
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
                      <SelectValue placeholder="Select a vendor…" />
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
                            setNewVendor((v) => ({
                              ...v,
                              name: e.target.value,
                            }))
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
                            setNewVendor((v) => ({
                              ...v,
                              email: e.target.value,
                            }))
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
                            <SelectValue />
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
                        setForm((f) => ({
                          ...f,
                          amountDollars: e.target.value,
                        }))
                      }
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
                    Use line items to break a bill into rows. They don't have to
                    sum to the total.
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
              </div>

              {createBill.isError && (
                <p className="text-sm text-destructive">
                  Could not create bill. Check the fields and try again.
                </p>
              )}
              {uploadAttachment.isError && (
                <p className="text-sm text-destructive">
                  Bill was created, but the attachment failed to upload.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 mt-6">
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              Cancel
            </Link>
            <Button type="submit" disabled={submitting || !form.vendorId}>
              {submitting ? "Saving…" : "Save as draft"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
