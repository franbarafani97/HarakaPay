import { useMemo } from "react";
import { cn } from "../lib/utils";

function hueFor(name: string): number {
  const c = name.charCodeAt(0) || 0;
  return (c * 7) % 360;
}

export function VendorAvatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const style = useMemo(() => {
    const h = hueFor(name);
    return {
      width: size,
      height: size,
      backgroundImage: `linear-gradient(135deg, hsl(${h} 30% 28%), hsl(${h} 35% 18%))`,
    } as const;
  }, [name, size]);

  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "inline-flex items-center justify-center rounded-[9px] text-[12px] font-semibold text-[#f5f1e8] select-none",
        className,
      )}
    >
      {initial}
    </span>
  );
}
