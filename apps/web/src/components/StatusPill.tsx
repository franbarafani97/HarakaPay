import type { BillStatus } from "@harakapay/shared";
import { Badge } from "./ui/badge";

const VARIANT: Record<BillStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  pending_approval: "bg-primary/15 text-primary border-transparent",
  approved: "bg-foreground/10 text-foreground border-transparent",
  scheduled: "bg-secondary text-secondary-foreground border-transparent",
  paid: "bg-primary text-primary-foreground border-transparent",
  rejected: "bg-destructive/15 text-destructive border-transparent",
};

const LABEL: Record<BillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  paid: "Paid",
  rejected: "Rejected",
};

export function StatusPill({ status }: { status: BillStatus }) {
  return <Badge className={VARIANT[status]}>{LABEL[status]}</Badge>;
}
