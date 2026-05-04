import { Link, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import BillForm, {
  type BillFormPayload,
  type BillFormValues,
} from "../components/BillForm";
import { useBill, useUpdateBill, useUploadAttachment } from "../hooks/useBills";

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const billQuery = useBill(id);
  const updateBill = useUpdateBill();
  const uploadAttachment = useUploadAttachment();

  if (billQuery.isLoading) {
    return (
      <Page>
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  }
  if (billQuery.isError || !billQuery.data) {
    return (
      <Page>
        <p className="text-destructive">Bill not found.</p>
        <Link to="/bills" className="text-sm text-primary hover:underline">
          ← Back to bills
        </Link>
      </Page>
    );
  }

  const bill = billQuery.data;

  if (bill.status !== "draft" && bill.status !== "rejected") {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">
          This bill cannot be edited in status{" "}
          <span className="font-medium text-foreground">{bill.status}</span>.
        </p>
        <Link
          to={`/bills/${bill.id}`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to bill
        </Link>
      </Page>
    );
  }

  const initial: BillFormValues = {
    vendorId: bill.vendorId,
    invoiceNumber: bill.invoiceNumber,
    amountDollars: (bill.amountCents / 100).toFixed(2),
    issueDate: new Date(bill.issueDate).toISOString().slice(0, 10),
    dueDate: new Date(bill.dueDate).toISOString().slice(0, 10),
    memo: bill.memo ?? "",
    glCode: bill.glCode ?? "",
    lineItems: (bill.lineItems ?? []).map((li) => ({
      description: li.description,
      amountDollars: (li.amountCents / 100).toFixed(2),
      glCode: li.glCode ?? "",
    })),
  };

  async function onSubmit(payload: BillFormPayload) {
    await updateBill.mutateAsync({
      id: bill.id,
      vendorId: payload.vendorId,
      invoiceNumber: payload.invoiceNumber,
      amountCents: payload.amountCents,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      memo: payload.memo,
      glCode: payload.glCode,
      lineItems: payload.lineItems,
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
    <Page>
      <h2 className="text-2xl font-semibold tracking-tight mb-6">Edit bill</h2>
      <BillForm
        initial={initial}
        initialAttachmentName={bill.attachmentFilename ?? undefined}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        cancelHref={`/bills/${bill.id}`}
        isPending={updateBill.isPending || uploadAttachment.isPending}
        isError={updateBill.isError}
        errorMessage="Could not save changes. Check the fields and try again."
        uploadErrorMessage={
          uploadAttachment.isError
            ? "Bill was saved, but the attachment failed to upload."
            : undefined
        }
        onSubmit={onSubmit}
      />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  );
}
