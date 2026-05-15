import { createContext, useContext } from "react";

export type ThemeMode = "dark" | "light";

export type AccentSwatch = {
  name: string;
  value: string;
};

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { name: "Sunset", value: "#FF7A2A" },
  { name: "Citrus", value: "#FFB347" },
  { name: "Forest", value: "#7BB369" },
  { name: "Ocean", value: "#3B82F6" },
  { name: "Iris", value: "#A78BFA" },
  { name: "Berry", value: "#EC4899" },
];

export const DEFAULT_ACCENT = ACCENT_SWATCHES[0].value;
export const DEFAULT_MODE: ThemeMode = "dark";

export const MODE_KEY = "hp.theme.mode";
export const ACCENT_KEY = "hp.theme.accent";

export type ThemeContextValue = {
  mode: ThemeMode;
  accent: string;
  swatches: AccentSwatch[];
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setAccent: (color: string) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
