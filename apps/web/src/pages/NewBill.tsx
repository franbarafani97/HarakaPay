import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BillForm, {
  type BillFormPayload,
  type BillFormValues,
} from "../components/BillForm";
import { useCreateBill, useUploadAttachment } from "../hooks/useBills";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDaysISO(n: number): string {
  return new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);
}

const INITIAL: BillFormValues = {
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
        <h2 className="text-2xl font-semibold tracking-tight mb-6">New bill</h2>
        <BillForm
          initial={INITIAL}
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
      </main>
    </div>
  );
}
