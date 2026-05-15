import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-36 flex-col justify-between rounded-[20px] p-[22px]",
        "border border-hp-border bg-hp-surface backdrop-blur-xl",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-hp-text-dim">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm",
            accent
              ? "text-[var(--hp-accent)]"
              : "bg-foreground/5 text-hp-text-dim",
          )}
          style={
            accent
              ? {
                  background:
                    "color-mix(in srgb, var(--hp-accent) 14%, transparent)",
                }
              : undefined
          }
        >
          {icon}
        </span>
      </div>
      <div>
        <div
          className={cn(
            "font-mono text-[36px] font-medium leading-none tracking-[-0.025em] text-foreground",
            loading && "opacity-30",
          )}
        >
          {loading ? "—" : value}
        </div>
        {sub && !loading && (
          <div className="mt-2 text-[12px] text-hp-text-dim">{sub}</div>
        )}
      </div>
    </div>
  );
}
