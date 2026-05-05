import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Bill, BillStatus } from "@harakapay/shared";
import { StatusPill } from "./StatusPill";
import { useMe } from "../hooks/useAuth";
import {
  useBillsList,
  useBulkApprove,
  useTransitionBill,
} from "../hooks/useBills";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "../lib/utils";

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

export function BillsListSection() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const navigate = useNavigate();
  const { data: user } = useMe();
  const isApprover = user?.role === "approver";

  const bills = useBillsList(filter === "all" ? {} : { status: filter });
  const transitionBill = useTransitionBill();
  const bulkApprove = useBulkApprove();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setSelected(new Set());
    setResultMessage(null);
    setActiveIndex(0);
  }, [filter]);

  const list = bills.data?.bills ?? [];

  useEffect(() => {
    if (activeIndex >= list.length) {
      setActiveIndex(Math.max(0, list.length - 1));
    }
  }, [list.length, activeIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target && target.isContentEditable)
      ) {
        return;
      }
      if (list.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, list.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const bill = list[activeIndex];
        if (bill) {
          e.preventDefault();
          navigate(`/bills/${bill.id}`);
        }
      } else if (e.key === "e" && isApprover) {
        const bill = list[activeIndex];
        if (bill?.status === "pending_approval") {
          e.preventDefault();
          transitionBill.mutate({ id: bill.id, to: "approved" } as never);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, activeIndex, isApprover, navigate, transitionBill]);

  useEffect(() => {
    const el = document.querySelector('[data-active-row="true"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
    <div>
      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterValue)}
        className="mb-4"
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
        <>
          <BillsTable
            bills={list}
            activeIndex={activeIndex}
            selected={selected}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            allSelected={allSelected}
            showSelectionColumn={showSelectionColumn}
          />
          <KeyboardHint isApprover={isApprover} />
        </>
      )}
    </div>
  );
}

function BillsTable({
  bills,
  activeIndex,
  selected,
  onToggleRow,
  onToggleAll,
  allSelected,
  showSelectionColumn,
}: {
  bills: Bill[];
  activeIndex: number;
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
          {bills.map((bill, i) => {
            const isPending = bill.status === "pending_approval";
            const isActive = i === activeIndex;
            return (
              <TableRow
                key={bill.id}
                onClick={() => navigate(`/bills/${bill.id}`)}
                data-active-row={isActive ? "true" : undefined}
                className={cn(
                  "cursor-pointer transition-colors",
                  isActive && "bg-muted/50",
                )}
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

function KeyboardHint({ isApprover }: { isApprover: boolean }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        <Kbd>j</Kbd>
        <span className="mx-1">/</span>
        <Kbd>k</Kbd> navigate
      </span>
      <span>
        <Kbd>↵</Kbd> open
      </span>
      {isApprover && (
        <span>
          <Kbd>e</Kbd> approve pending
        </span>
      )}
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
      {children}
    </kbd>
  );
}

function EmptyState({ filter }: { filter: FilterValue }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground">
          {filter === "all" ? "No bills yet." : "No bills with this status."}
        </p>
      </CardContent>
    </Card>
  );
}
