import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { BillsListSection } from "../components/BillsListSection";
import { KpiCard } from "../components/KpiCard";
import { HPKey } from "../components/HPKey";
import { useDashboardSummary } from "../hooks/useDashboard";
import { useMe } from "../hooks/useAuth";
import { apiBaseURL } from "../lib/api";
import { cn } from "../lib/utils";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function formatMoney(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

function pluralize(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFromEmail(email: string | undefined): string {
  if (!email) return "Demo";
  const local = email.split("@")[0] ?? "";
  const head = local.split(/[._-]/)[0] ?? "";
  if (!head) return "Demo";
  return head.charAt(0).toUpperCase() + head.slice(1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const summary = useDashboardSummary();
  const { data: user } = useMe();
  const data = summary.data;
  const isLoading = summary.isLoading;

  const now = new Date();
  const greeting = greetingFor(now);
  const firstName = firstNameFromEmail(user?.email);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target && target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      navigate("/bills/new");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="flex-1 px-14 py-10">
        <section className="mb-9">
          <div className="mb-1.5 text-[13px] font-medium text-hp-text-dim">
            {dateFormatter.format(now)}
          </div>
          <div className="flex items-end justify-between gap-6">
            <h1 className="m-0 text-[40px] font-bold tracking-[-0.035em] text-foreground">
              {greeting}, {firstName}.
            </h1>
            <div className="flex items-center gap-2.5">
              <Link
                to="/bills/new"
                style={{ backgroundColor: "var(--hp-accent)" }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-5 py-[9px] text-[13px] font-semibold",
                  "text-[#0c0c0e] transition-[filter,transform]",
                  "hover:brightness-110 active:translate-y-px",
                )}
              >
                + New bill
                <HPKey className="border-[#0c0c0e]/20 bg-[#0c0c0e]/10 text-[#0c0c0e]/80">
                  N
                </HPKey>
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Needs my approval"
            value={data?.needsMyApproval ?? 0}
            sub="Pending decisions"
            icon="!"
            accent
            loading={isLoading}
          />
          <KpiCard
            label="Due this week"
            value={data?.dueThisWeek ?? 0}
            sub={data?.dueThisWeek === 0 ? "All clear" : "Bills due ≤ 7 days"}
            icon="○"
            loading={isLoading}
          />
          <KpiCard
            label="Scheduled this week"
            value={data?.scheduledThisWeek ?? 0}
            sub="Scheduled to pay"
            icon="◷"
            loading={isLoading}
          />
          <KpiCard
            label="Paid this month"
            value={data ? formatMoney(data.paidThisMonth.totalCents) : "$0"}
            sub={
              data
                ? pluralize(data.paidThisMonth.count, "bill", "bills")
                : undefined
            }
            icon="✓"
            loading={isLoading}
          />
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em] text-foreground">
                Bills
              </h2>
              <div className="mt-0.5 text-[13px] text-hp-text-dim">
                Manage what's incoming, scheduled, and paid
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/bills")}
                className={cn(
                  "inline-flex items-center rounded-full px-3.5 py-[7px] text-[12.5px] font-medium",
                  "border border-hp-border bg-transparent text-foreground",
                  "transition-colors hover:bg-foreground/5",
                )}
              >
                Open Bills page
              </button>
              <a
                href={`${apiBaseURL}/export/bills.csv`}
                className={cn(
                  "inline-flex items-center rounded-full px-3.5 py-[7px] text-[12.5px] font-medium",
                  "border border-hp-border bg-transparent text-foreground",
                  "transition-colors hover:bg-foreground/5",
                )}
              >
                Export CSV
              </a>
            </div>
          </div>

          <BillsListSection />
        </section>
      </main>
    </div>
  );
}
