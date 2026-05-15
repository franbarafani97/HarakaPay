import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ACCENT_SWATCHES,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  MODE_KEY,
  ACCENT_KEY,
  ThemeContext,
  type ThemeContextValue,
  type ThemeMode,
} from "./theme-context";

function readMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const raw = window.localStorage.getItem(MODE_KEY);
  return raw === "light" || raw === "dark" ? raw : DEFAULT_MODE;
}

function readAccent(): string {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const raw = window.localStorage.getItem(ACCENT_KEY);
  return raw && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : DEFAULT_ACCENT;
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

function applyAccent(color: string) {
  document.documentElement.style.setProperty("--hp-accent", color);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [accent, setAccentState] = useState<string>(readAccent);

  useEffect(() => {
    applyMode(mode);
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    applyAccent(accent);
    window.localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const toggleMode = useCallback(
    () => setModeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );
  const setAccent = useCallback((next: string) => setAccentState(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      accent,
      swatches: ACCENT_SWATCHES,
      setMode,
      toggleMode,
      setAccent,
    }),
    [mode, accent, setMode, toggleMode, setAccent],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
