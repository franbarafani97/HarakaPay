import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth";
import { useDashboardSummary } from "../hooks/useDashboard";

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
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const summary = useDashboardSummary();

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

  const data = summary.data;
  const isLoading = summary.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">HarakaPay</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <button
              onClick={onLogout}
              disabled={logout.isPending}
              className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {logout.isPending ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            label="Needs my approval"
            value={data?.needsMyApproval}
            loading={isLoading}
          />
          <Card
            label="Due this week"
            value={data?.dueThisWeek}
            loading={isLoading}
          />
          <Card
            label="Scheduled this week"
            value={data?.scheduledThisWeek}
            loading={isLoading}
          />
          <Card
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

function Card({
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
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {loading ? "—" : (value ?? 0)}
      </p>
      {sublabel && !loading && (
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
