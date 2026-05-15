import type { BillStatus } from "@harakapay/shared";

type StatusStyle = {
  label: string;
  bg: string;
  fg: string;
};

const STATUS_STYLES: Record<BillStatus, StatusStyle> = {
  draft: {
    label: "Draft",
    bg: "rgba(160,154,141,0.12)",
    fg: "#A09a8d",
  },
  pending_approval: {
    label: "Pending",
    bg: "rgba(255,179,71,0.14)",
    fg: "#FFB347",
  },
  approved: {
    label: "Approved",
    bg: "rgba(123,179,105,0.14)",
    fg: "#A6D996",
  },
  scheduled: {
    label: "Scheduled",
    bg: "rgba(167,139,250,0.14)",
    fg: "#C7B6FF",
  },
  paid: {
    label: "Paid",
    bg: "color-mix(in srgb, var(--hp-accent) 16%, transparent)",
    fg: "color-mix(in srgb, var(--hp-accent) 70%, white)",
  },
  rejected: {
    label: "Rejected",
    bg: "rgba(217,87,61,0.16)",
    fg: "#F08572",
  },
};

export function StatusPill({ status }: { status: BillStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{ background: s.bg, color: s.fg }}
      className="inline-flex items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold tracking-[0.1px]"
    >
      {s.label}
    </span>
  );
}
