import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function HPKey({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-[5px]",
        "font-mono text-[11px] font-medium leading-none",
        "border border-foreground/15 bg-foreground/10 text-foreground/80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
