import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  allowedTransitions,
  type Activity,
  type Bill,
  type BillStatus,
  type Role,
} from "@harakapay/shared";
import AppHeader from "../components/AppHeader";
import { StatusPill } from "../components/StatusPill";
import { useMe } from "../hooks/useAuth";
import { useBill, useDeleteBill, useTransitionBill } from "../hooks/useBills";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Textarea } from "../components/ui/textarea";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dateFormatter.format(d);
}

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const billQuery = useBill(id);

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

  return (
    <Page>
      <Link
        to="/bills"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to bills
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {bill.vendor?.name ?? "Unknown vendor"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {bill.invoiceNumber} · Due{" "}
            {dateFormatter.format(new Date(bill.dueDate))}
          </p>
        </div>
        <div className="text-right space-y-2">
          <p className="text-3xl font-semibold tabular-nums">
            {moneyFormatter.format(bill.amountCents / 100)}
          </p>
          <StatusPill status={bill.status} />
        </div>
      </div>

      {user && (
        <ActionBar
          bill={bill}
          role={user.role}
          userId={user.id}
          onDeleted={() => navigate("/bills")}
        />
      )}

      <Section title="Details">
        <DetailGrid bill={bill} />
      </Section>

      {bill.lineItems && bill.lineItems.length > 0 && (
        <Section title="Line items">
          <LineItems items={bill.lineItems} totalCents={bill.amountCents} />
        </Section>
      )}

      {bill.attachmentFilename && (
        <Section title="Attachment">
          <Card>
            <CardContent className="py-4">
              <a
                href={`${import.meta.env.VITE_API_URL}/bills/${bill.id}/attachment`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span aria-hidden>📎</span>
                {bill.attachmentFilename}
              </a>
            </CardContent>
          </Card>
        </Section>
      )}

      <Section title="Activity">
        <ActivityLog activities={bill.activities ?? []} />
      </Section>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ bill }: { bill: Bill }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Issued", dateFormatter.format(new Date(bill.issueDate))],
    ["Due", dateFormatter.format(new Date(bill.dueDate))],
  ];
  if (bill.memo) rows.push(["Memo", bill.memo]);
  if (bill.glCode) rows.push(["GL code", bill.glCode]);
  if (bill.submittedBy) rows.push(["Submitted by", bill.submittedBy.name]);
  if (bill.approvedBy) rows.push(["Approver", bill.approvedBy.name]);
  if (bill.paymentDate) {
    rows.push([
      "Payment date",
      dateFormatter.format(new Date(bill.paymentDate)),
    ]);
  }
  if (bill.paymentConfirmation) {
    rows.push(["Confirmation", bill.paymentConfirmation]);
  }
  if (bill.rejectionReason) {
    rows.push(["Rejection reason", bill.rejectionReason]);
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-4 px-4 py-3 text-sm"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground text-right">{value}</dd>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LineItems({
  items,
  totalCents,
}: {
  items: NonNullable<Bill["lineItems"]>;
  totalCents: number;
}) {
  const lineSum = items.reduce((acc, li) => acc + li.amountCents, 0);
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {items.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-2.5">{li.description}</td>
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums w-20">
                  {li.glCode ?? ""}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums w-32">
                  {moneyFormatter.format(li.amountCents / 100)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-4 py-2.5 text-muted-foreground" colSpan={2}>
                Sum of line items
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {moneyFormatter.format(lineSum / 100)}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-medium" colSpan={2}>
                Bill total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                {moneyFormatter.format(totalCents / 100)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

function ActivityLog({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <Card>
      <CardContent className="py-4">
        <ol className="space-y-2">
          {activities.map((a) => (
            <li
              key={a.id}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span>
                <span className="font-medium">{a.user?.name ?? "Someone"}</span>{" "}
                <span className="text-muted-foreground">
                  {describeActivity(a)}
                </span>
              </span>
              <time
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
                dateTime={a.createdAt}
                title={dateTimeFormatter.format(new Date(a.createdAt))}
              >
                {formatRelative(a.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function describeActivity(a: Activity): string {
  switch (a.type) {
    case "created":
      return "created this bill";
    case "edited":
      return "edited this bill";
    case "submitted":
      return "submitted for approval";
    case "approved":
      return "approved this bill";
    case "rejected":
      return `rejected this bill${
        a.metadata && typeof a.metadata.reason === "string"
          ? `: ${a.metadata.reason}`
          : ""
      }`;
    case "scheduled":
      return "scheduled payment";
    case "paid":
      return "marked as paid";
  }
}

function ActionBar({
  bill,
  role,
  userId,
  onDeleted,
}: {
  bill: Bill;
  role: Role;
  userId: string;
  onDeleted: () => void;
}) {
  const transitionTargets = allowedTransitions(bill.status, role);
  const transition = useTransitionBill();
  const deleteBill = useDeleteBill();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [paymentDate, setPaymentDate] = useState("");

  const canDelete = bill.status === "draft" && bill.submittedById === userId;
  const isPending = transition.isPending || deleteBill.isPending;

  function fire(target: BillStatus) {
    if (target === "rejected") return setRejectOpen(true);
    if (target === "scheduled") return setScheduleOpen(true);
    transition.mutate({ id: bill.id, to: target } as never);
  }

  function confirmReject() {
    transition.mutate(
      {
        id: bill.id,
        to: "rejected",
        rejectionReason: rejectReason,
      } as never,
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason("");
        },
      },
    );
  }

  function confirmSchedule() {
    transition.mutate(
      {
        id: bill.id,
        to: "scheduled",
        paymentDate: new Date(`${paymentDate}T00:00:00.000Z`).toISOString(),
      } as never,
      {
        onSuccess: () => {
          setScheduleOpen(false);
          setPaymentDate("");
        },
      },
    );
  }

  function onDelete() {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    deleteBill.mutate(bill.id, { onSuccess: onDeleted });
  }

  if (transitionTargets.length === 0 && !canDelete) return null;

  return (
    <>
      <Card className="mt-6">
        <CardContent className="py-4 flex flex-wrap items-center gap-2">
          {transitionTargets.map((target) => (
            <Button
              key={target}
              type="button"
              variant={variantForTarget(target)}
              size="sm"
              onClick={() => fire(target)}
              disabled={isPending}
            >
              {actionLabel(bill.status, target)}
            </Button>
          ))}
          {canDelete && (
            <>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isPending}
              >
                Delete draft
              </Button>
            </>
          )}
          {transition.isError && (
            <p className="ml-auto text-sm text-destructive">
              Action failed. Try again.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this bill</DialogTitle>
            <DialogDescription>
              The submitter will see this and can revise the bill back to draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Wrong PO referenced"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectReason.trim() || transition.isPending}
            >
              {transition.isPending ? "Rejecting…" : "Confirm reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule payment</DialogTitle>
            <DialogDescription>
              Pick the date the payment goes out. The bill will move to
              Scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmSchedule}
              disabled={!paymentDate || transition.isPending}
            >
              {transition.isPending ? "Scheduling…" : "Schedule payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function variantForTarget(
  target: BillStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (target) {
    case "approved":
    case "paid":
    case "pending_approval":
      return "default";
    case "rejected":
      return "destructive";
    case "scheduled":
      return "secondary";
    case "draft":
      return "outline";
  }
}

function actionLabel(from: BillStatus, to: BillStatus): string {
  if (to === "pending_approval") return "Submit for approval";
  if (to === "approved" && from === "scheduled") return "Unschedule";
  if (to === "approved") return "Approve";
  if (to === "rejected") return "Reject";
  if (to === "scheduled") return "Schedule payment";
  if (to === "paid") return "Mark as paid";
  if (to === "draft" && from === "pending_approval") return "Recall to draft";
  if (to === "draft") return "Edit (back to draft)";
  return to;
}
