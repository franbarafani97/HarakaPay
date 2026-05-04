import type { BillStatus } from "./bill.js";
import type { Role } from "./user.js";

export interface Transition {
  from: BillStatus;
  to: BillStatus;
  role: Role;
}

export const TRANSITIONS: ReadonlyArray<Transition> = [
  { from: "draft", to: "pending_approval", role: "submitter" },
  { from: "pending_approval", to: "draft", role: "submitter" },
  { from: "pending_approval", to: "approved", role: "approver" },
  { from: "pending_approval", to: "rejected", role: "approver" },
  { from: "approved", to: "scheduled", role: "approver" },
  { from: "approved", to: "rejected", role: "approver" },
  { from: "scheduled", to: "approved", role: "approver" },
  { from: "scheduled", to: "paid", role: "approver" },
  { from: "rejected", to: "draft", role: "submitter" },
];

export function canTransition(
  from: BillStatus,
  to: BillStatus,
  role: Role,
): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.role === role,
  );
}

export function allowedTransitions(from: BillStatus, role: Role): BillStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.role === role).map(
    (t) => t.to,
  );
}
