import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { BillsListSection } from "../components/BillsListSection";
import { buttonVariants } from "../components/ui/button";
import { apiBaseURL } from "../lib/api";

export default function BillsInbox() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Bills</h2>
          <div className="flex items-center gap-2">
            <a
              href={`${apiBaseURL}/export/bills.csv`}
              className={buttonVariants({ variant: "outline" })}
            >
              Export CSV
            </a>
            <Link to="/bills/new" className={buttonVariants()}>
              + New bill
            </Link>
          </div>
        </div>

        <BillsListSection />
      </main>
    </div>
  );
}
