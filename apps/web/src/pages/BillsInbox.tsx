import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { BillsListSection } from "../components/BillsListSection";
import { HPKey } from "../components/HPKey";
import { apiBaseURL } from "../lib/api";
import { cn } from "../lib/utils";

export default function BillsInbox() {
  const navigate = useNavigate();

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
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="m-0 text-[32px] font-bold tracking-[-0.03em] text-foreground">
              Bills
            </h1>
            <div className="mt-1 text-[13px] text-hp-text-dim">
              Filter, approve, and track every payable
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href={`${apiBaseURL}/export/bills.csv`}
              className={cn(
                "inline-flex items-center rounded-full px-[18px] py-[9px] text-[13px] font-medium",
                "border border-hp-border bg-foreground/[0.06] text-foreground",
                "transition-colors hover:bg-foreground/[0.1]",
              )}
            >
              Export CSV
            </a>
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

        <BillsListSection />
      </main>
    </div>
  );
}
