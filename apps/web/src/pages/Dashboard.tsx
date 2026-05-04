import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useDashboardSummary } from "../hooks/useDashboard";
import { buttonVariants } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "../components/ui/card";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

function pluralize(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export default function Dashboard() {
  const summary = useDashboardSummary();

  const data = summary.data;
  const isLoading = summary.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <Link to="/bills/new" className={buttonVariants()}>
            + New bill
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Needs my approval"
            value={data?.needsMyApproval}
            loading={isLoading}
          />
          <MetricCard
            label="Due this week"
            value={data?.dueThisWeek}
            loading={isLoading}
          />
          <MetricCard
            label="Scheduled this week"
            value={data?.scheduledThisWeek}
            loading={isLoading}
          />
          <MetricCard
            label="Paid this month"
            value={
              data ? formatMoney(data.paidThisMonth.totalCents) : undefined
            }
            sublabel={
              data
                ? pluralize(data.paidThisMonth.count, "bill", "bills")
                : undefined
            }
            loading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  loading,
}: {
  label: string;
  value: string | number | undefined;
  sublabel?: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">
          {loading ? "—" : (value ?? 0)}
        </p>
        {sublabel && !loading && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
