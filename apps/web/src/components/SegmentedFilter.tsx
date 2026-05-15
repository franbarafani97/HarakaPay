import { cn } from "../lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-px rounded-[11px] p-[3px]",
        "border border-hp-border bg-foreground/5",
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-[background,box-shadow,color] duration-150 ease-out",
              selected
                ? "bg-foreground/10 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_0_0_0.5px_rgba(255,255,255,0.1)]"
                : "text-hp-text-dim hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
