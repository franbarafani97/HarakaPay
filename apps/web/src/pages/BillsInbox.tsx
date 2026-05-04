import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { BillStatus } from "@harakapay/shared";
import AppHeader from "../components/AppHeader";
import { StatusPill } from "../components/StatusPill";
import { useBillsList } from "../hooks/useBills";
import { buttonVariants } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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

  const bills = useBillsList(filter === "all" ? {} : { status: filter });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Bills</h2>
          <Link to="/bills/new" className={buttonVariants()}>
            + New bill
          </Link>
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
        ) : !bills.data || bills.data.bills.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <BillsTable bills={bills.data.bills} />
        )}
      </main>
    </div>
  );
}

type BillRow = NonNullable<
  ReturnType<typeof useBillsList>["data"]
>["bills"][number];

function BillsTable({ bills }: { bills: BillRow[] }) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow
              key={bill.id}
              onClick={() => navigate(`/bills/${bill.id}`)}
              className="cursor-pointer"
            >
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
          ))}
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
