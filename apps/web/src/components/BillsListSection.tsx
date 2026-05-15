import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Bill, BillStatus } from "@harakapay/shared";
import { StatusPill } from "./StatusPill";
import { VendorAvatar } from "./VendorAvatar";
import { HPKey } from "./HPKey";
import { SegmentedFilter } from "./SegmentedFilter";
import { useMe } from "../hooks/useAuth";
import {
  useBillsList,
  useBulkApprove,
  useTransitionBill,
} from "../hooks/useBills";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { cn } from "../lib/utils";

type FilterValue = BillStatus | "all";

const STATUS_TABS = [
  { value: "all" as const, label: "All" },
  { value: "draft" as const, label: "Draft" },
  { value: "pending_approval" as const, label: "Pending" },
  { value: "approved" as const, label: "Approved" },
  { value: "scheduled" as const, label: "Scheduled" },
  { value: "paid" as const, label: "Paid" },
  { value: "rejected" as const, label: "Rejected" },
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

const ROW_GRID =
  "grid-cols-[40px_1.5fr_1fr_1fr_1.1fr_110px_24px] gap-x-4 px-[22px] py-4";

export function BillsListSection({
  filter,
  onFilterChange,
  showFilter = true,
}: {
  filter?: FilterValue;
  onFilterChange?: (next: FilterValue) => void;
  showFilter?: boolean;
}) {
  const [internalFilter, setInternalFilter] = useState<FilterValue>("all");
  const navigate = useNavigate();
  const { data: user } = useMe();
  const isApprover = user?.role === "approver";

  const activeFilter = filter ?? internalFilter;
  const setFilter = (next: FilterValue) => {
    setInternalFilter(next);
    onFilterChange?.(next);
  };

  const bills = useBillsList(
    activeFilter === "all" ? {} : { status: activeFilter },
  );
  const transitionBill = useTransitionBill();
  const bulkApprove = useBulkApprove();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setSelected(new Set());
    setResultMessage(null);
    setActiveIndex(0);
  }, [activeFilter]);

  const list = useMemo(() => bills.data?.bills ?? [], [bills.data]);

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

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, list.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const bill = list[activeIndex];
        if (bill) {
          e.preventDefault();
          navigate(`/bills/${bill.id}`);
        }
      } else if ((e.key === "e" || e.key === "E") && isApprover) {
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

  const selectableIds = useMemo(
    () => list.filter((b) => b.status === "pending_approval").map((b) => b.id),
    [list],
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const showSelection = isApprover && selectableIds.length > 0;

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
    const failed = results.filter((r) => !r.success).length;
    setSelected(new Set());
    setResultMessage(
      failed === 0
        ? `${results.length} bill${results.length > 1 ? "s" : ""} approved.`
        : `Approved ${results.length - failed} of ${results.length}. ${failed} could not be approved (state changed).`,
    );
  }

  return (
    <div>
      {showFilter && (
        <div className="mb-4">
          <SegmentedFilter
            ariaLabel="Filter bills by status"
            options={STATUS_TABS}
            value={activeFilter}
            onChange={setFilter}
          />
        </div>
      )}

      {showSelection && selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-hp-border bg-hp-surface px-4 py-3">
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
        </div>
      )}

      {resultMessage && selected.size === 0 && (
        <p className="mb-4 text-sm text-hp-text-dim">{resultMessage}</p>
      )}

      {bills.isLoading ? (
        <BillsCardShell>
          <SkeletonRows />
        </BillsCardShell>
      ) : bills.isError ? (
        <BillsCardShell>
          <div className="py-16 text-center text-destructive">
            Could not load bills.
          </div>
        </BillsCardShell>
      ) : list.length === 0 ? (
        <EmptyState filter={activeFilter} onClear={() => setFilter("all")} />
      ) : (
        <>
          {showSelection && (
            <div className="mb-2 flex items-center gap-2 pl-[22px] text-[12px] text-hp-text-dim">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all pending bills"
              />
              <span>Select all pending</span>
            </div>
          )}
          <BillsCardShell>
            {list.map((bill, i) => (
              <BillRow
                key={bill.id}
                bill={bill}
                isLast={i === list.length - 1}
                isActive={i === activeIndex}
                selectable={isApprover && bill.status === "pending_approval"}
                selected={selected.has(bill.id)}
                onToggle={() => toggleRow(bill.id)}
                onOpen={() => navigate(`/bills/${bill.id}`)}
              />
            ))}
          </BillsCardShell>
          <KeyboardHint isApprover={isApprover} />
        </>
      )}
    </div>
  );
}

function BillsCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-hp-border bg-hp-surface backdrop-blur-xl">
      {children}
    </div>
  );
}

function BillRow({
  bill,
  isLast,
  isActive,
  selectable,
  selected,
  onToggle,
  onOpen,
}: {
  bill: Bill;
  isLast: boolean;
  isActive: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const vendorName = bill.vendor?.name ?? "—";
  return (
    <div
      data-active-row={isActive ? "true" : undefined}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "grid items-center cursor-pointer transition-colors duration-150",
        ROW_GRID,
        !isLast && "border-b border-white/[0.05] dark:border-white/[0.05]",
        isActive ? "bg-foreground/[0.04]" : "hover:bg-foreground/[0.04]",
      )}
    >
      {selectable ? (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={`Select bill ${bill.invoiceNumber}`}
          />
        </div>
      ) : (
        <VendorAvatar name={vendorName} size={32} />
      )}

      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold text-foreground">
          {vendorName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11.5px] text-hp-text-mute">
          {bill.invoiceNumber}
        </div>
      </div>

      <div className="font-mono text-[14px] font-medium tabular-nums text-foreground">
        {moneyFormatter.format(bill.amountCents / 100)}
      </div>

      <div className="text-[13px] text-hp-text-dim">
        {dateFormatter.format(new Date(bill.dueDate))}
      </div>

      <div className="font-mono text-[12px] text-hp-text-mute">
        issued {dateFormatter.format(new Date(bill.issueDate))}
      </div>

      <div>
        <StatusPill status={bill.status} />
      </div>

      <div
        aria-hidden="true"
        className="text-right text-[16px] leading-none text-hp-text-mute"
      >
        ›
      </div>
    </div>
  );
}

function KeyboardHint({ isApprover }: { isApprover: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11.5px] text-hp-text-mute">
      <span className="inline-flex items-center gap-1.5">
        <HPKey>↑</HPKey>
        <HPKey>↓</HPKey>
        <span>navigate</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <HPKey>↵</HPKey>
        <span>open</span>
      </span>
      {isApprover && (
        <span className="inline-flex items-center gap-1.5">
          <HPKey>E</HPKey>
          <span>approve</span>
        </span>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "grid items-center",
            ROW_GRID,
            i !== 4 && "border-b border-white/[0.05]",
          )}
        >
          <div className="h-8 w-8 animate-pulse rounded-[9px] bg-foreground/10" />
          <div className="space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-foreground/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-foreground/10" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded bg-foreground/10" />
          <div className="h-3.5 w-24 animate-pulse rounded bg-foreground/10" />
          <div className="h-3.5 w-28 animate-pulse rounded bg-foreground/10" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-foreground/10" />
          <div />
        </div>
      ))}
    </>
  );
}

function EmptyState({
  filter,
  onClear,
}: {
  filter: FilterValue;
  onClear: () => void;
}) {
  const tabLabel =
    STATUS_TABS.find((t) => t.value === filter)?.label.toLowerCase() ?? "";
  const message = filter === "all" ? "No bills yet." : `No ${tabLabel} bills.`;
  return (
    <div className="rounded-[18px] border border-hp-border bg-hp-surface p-12 text-center">
      <p className="text-[16px] font-medium text-foreground">{message}</p>
      {filter !== "all" && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 inline-flex items-center rounded-full border border-hp-border bg-transparent px-4 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
