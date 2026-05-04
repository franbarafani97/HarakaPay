import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth";
import { useDashboardSummary } from "../hooks/useDashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const summary = useDashboardSummary();

  function onLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  }

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
            value={summary.data?.needsMyApproval}
            loading={summary.isLoading}
          />
          <Card
            label="Due this week"
            value={summary.data?.dueThisWeek}
            loading={summary.isLoading}
          />
        </div>
      </main>
    </div>
  );
}

function Card({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {loading ? "—" : (value ?? 0)}
      </p>
    </div>
  );
}
