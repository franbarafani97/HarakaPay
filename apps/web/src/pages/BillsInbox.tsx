import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Bill, BillStatus } from "@harakapay/shared";
import AppHeader from "../components/AppHeader";
import { StatusPill } from "../components/StatusPill";
import { useMe } from "../hooks/useAuth";
import { useBillsList, useBulkApprove } from "../hooks/useBills";
import { Button, buttonVariants } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";

type FilterValue = BillStatus | "all";

const STATUS_TABS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function BillsInbox() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const { data: user } = useMe();
  const isApprover = user?.role === "approver";

  const bills = useBillsList(filter === "all" ? {} : { status: filter });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const bulkApprove = useBulkApprove();

  useEffect(() => {
    setSelected(new Set());
    setResultMessage(null);
  }, [filter]);

  const list = bills.data?.bills ?? [];
  const selectableIds = list
    .filter((b) => b.status === "pending_approval")
    .map((b) => b.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const showSelectionColumn = isApprover && selectableIds.length > 0;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  async function onBulkApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const results = await bulkApprove.mutateAsync(ids);
    const failedCount = results.filter((r) => !r.success).length;
    setSelected(new Set());
    setResultMessage(
      failedCount === 0
        ? `${results.length} bill${results.length > 1 ? "s" : ""} approved.`
        : `Approved ${results.length - failedCount} of ${results.length}. ${failedCount} could not be approved (state changed).`,
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Bills</h2>
          <div className="flex items-center gap-2">
            <a
              href={`${import.meta.env.VITE_API_URL}/export/bills.csv${filter !== "all" ? `?status=${filter}` : ""}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Export CSV
            </a>
            <Link to="/bills/new" className={buttonVariants()}>
              + New bill
            </Link>
          </div>
        </div>

        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterValue)}
          className="mb-6"
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {selected.size > 0 && (
          <Card className="mb-4">
            <CardContent className="py-3 flex items-center justify-between">
              <p className="text-sm">
                <span className="font-medium">{selected.size}</span> selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  disabled={bulkApprove.isPending}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={onBulkApprove}
                  disabled={bulkApprove.isPending}
                >
                  {bulkApprove.isPending
                    ? "Approving…"
                    : `Approve ${selected.size}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {resultMessage && selected.size === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">{resultMessage}</p>
        )}

        {bills.isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : bills.isError ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive">
              Could not load bills.
            </CardContent>
          </Card>
        ) : list.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <BillsTable
            bills={list}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelected={allSelected}
            showSelectionColumn={showSelectionColumn}
          />
        )}
      </main>
    </div>
  );
}

function BillsTable({
  bills,
  selected,
  onToggleRow,
  onToggleAll,
  allSelected,
  showSelectionColumn,
}: {
  bills: Bill[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  showSelectionColumn: boolean;
}) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelectionColumn && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all pending bills"
                />
              </TableHead>
            )}
            <TableHead>Vendor</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => {
            const isPending = bill.status === "pending_approval";
            return (
              <TableRow
                key={bill.id}
                onClick={() => navigate(`/bills/${bill.id}`)}
                className="cursor-pointer"
              >
                {showSelectionColumn && (
                  <TableCell
                    className="w-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isPending && (
                      <Checkbox
                        checked={selected.has(bill.id)}
                        onCheckedChange={() => onToggleRow(bill.id)}
                        aria-label={`Select bill ${bill.invoiceNumber}`}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {bill.vendor?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {bill.invoiceNumber}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {moneyFormatter.format(bill.amountCents / 100)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateFormatter.format(new Date(bill.dueDate))}
                </TableCell>
                <TableCell>
                  <StatusPill status={bill.status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function EmptyState({ filter }: { filter: FilterValue }) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">
          {filter === "all" ? "No bills yet." : "No bills with this status."}
        </p>
        {filter === "all" && (
          <Link to="/bills/new" className={buttonVariants()}>
            + Create the first one
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
