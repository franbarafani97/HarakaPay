import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ExtractedFields } from "@harakapay/shared";
import AppHeader from "../components/AppHeader";
import BillForm, {
  type BillFormPayload,
  type BillFormValues,
} from "../components/BillForm";
import { ScanFromPhoneDialog } from "../components/ScanFromPhoneDialog";
import { Button } from "../components/ui/button";
import { useCreateBill, useUploadAttachment } from "../hooks/useBills";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDaysISO(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

const EMPTY_INITIAL: BillFormValues = {
  vendorId: "",
  invoiceNumber: "",
  amountDollars: "",
  issueDate: todayISO(),
  dueDate: inDaysISO(30),
  memo: "",
  glCode: "",
  lineItems: [],
};

export default function NewBill() {
  const navigate = useNavigate();
  const createBill = useCreateBill();
  const uploadAttachment = useUploadAttachment();

  const [initial, setInitial] = useState<BillFormValues>(EMPTY_INITIAL);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [scanOpen, setScanOpen] = useState(false);

  function onExtracted(e: ExtractedFields) {
    const next: BillFormValues = { ...EMPTY_INITIAL };
    const missing: string[] = [];

    if (e.invoiceNumber) next.invoiceNumber = e.invoiceNumber;
    else missing.push("invoiceNumber");

    if (e.amountCents != null) {
      next.amountDollars = (e.amountCents / 100).toFixed(2);
    } else {
      missing.push("amountDollars");
    }

    if (e.issueDate) {
      next.issueDate = new Date(e.issueDate).toISOString().slice(0, 10);
    } else {
      missing.push("issueDate");
    }

    if (e.dueDate) {
      next.dueDate = new Date(e.dueDate).toISOString().slice(0, 10);
    } else {
      missing.push("dueDate");
    }

    setInitial(next);
    setMissingFields(missing);
  }

  async function onSubmit(payload: BillFormPayload) {
    const lineItems =
      payload.lineItems.length > 0 ? payload.lineItems : undefined;
    const bill = await createBill.mutateAsync({
      vendorId: payload.vendorId,
      invoiceNumber: payload.invoiceNumber,
      amountCents: payload.amountCents,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      memo: payload.memo,
      glCode: payload.glCode,
      lineItems,
    });
    if (payload.file) {
      await uploadAttachment.mutateAsync({
        billId: bill.id,
        file: payload.file,
      });
    }
    navigate(`/bills/${bill.id}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">New bill</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setScanOpen(true)}
          >
            Scan from phone
          </Button>
        </div>

        <BillForm
          initial={initial}
          missingFields={missingFields}
          submitLabel="Save as draft"
          pendingLabel="Saving…"
          cancelHref="/"
          isPending={createBill.isPending || uploadAttachment.isPending}
          isError={createBill.isError}
          errorMessage="Could not create bill. Check the fields and try again."
          uploadErrorMessage={
            uploadAttachment.isError
              ? "Bill was created, but the attachment failed to upload."
              : undefined
          }
          onSubmit={onSubmit}
        />

        <ScanFromPhoneDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onResult={onExtracted}
        />
      </main>
    </div>
  );
}
