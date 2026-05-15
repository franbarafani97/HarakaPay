import { useEffect, useRef, useState } from "react";
import { useTheme } from "../lib/theme-context";
import { cn } from "../lib/utils";

export function SettingsMenu() {
  const { mode, accent, swatches, toggleMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Appearance settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg",
          "border border-hp-border bg-foreground/5 text-hp-text-dim",
          "transition-colors hover:text-foreground hover:bg-foreground/10",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className={cn(
            "absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-2xl p-3",
            "border border-hp-border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl",
          )}
        >
          <div className="mb-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-hp-text-dim">
              Theme
            </div>
            <div className="flex rounded-lg border border-hp-border bg-foreground/5 p-[3px]">
              <button
                type="button"
                onClick={() => mode === "dark" && toggleMode()}
                aria-pressed={mode === "light"}
                className={cn(
                  "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  mode === "light"
                    ? "bg-foreground/10 text-foreground"
                    : "text-hp-text-dim hover:text-foreground",
                )}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => mode === "light" && toggleMode()}
                aria-pressed={mode === "dark"}
                className={cn(
                  "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  mode === "dark"
                    ? "bg-foreground/10 text-foreground"
                    : "text-hp-text-dim hover:text-foreground",
                )}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-hp-text-dim">
              Accent
            </div>
            <div className="grid grid-cols-6 gap-2">
              {swatches.map((s) => {
                const selected = accent.toLowerCase() === s.value.toLowerCase();
                return (
                  <button
                    key={s.value}
                    type="button"
                    aria-label={s.name}
                    aria-pressed={selected}
                    onClick={() => setAccent(s.value)}
                    style={{ backgroundColor: s.value }}
                    className={cn(
                      "h-7 w-7 rounded-full transition-all",
                      selected
                        ? "ring-2 ring-offset-2 ring-offset-popover ring-foreground/60 scale-110"
                        : "hover:scale-110",
                    )}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-hp-text-dim">
              <span>Custom</span>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Pick a custom accent color"
                className="h-6 w-12 cursor-pointer rounded border border-hp-border bg-transparent"
              />
              <code className="font-mono text-[11px] text-hp-text-dim">
                {accent.toUpperCase()}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
