import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { tr } from "../i18n/index.js";

export function getPreferredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("bekatos-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme-version", theme);
  document.body.setAttribute("data-bs-theme", theme);
  localStorage.setItem("bekatos-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = getPreferredTheme();
    setTheme(current);
    applyTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";
  const label = isDark ? tr("light_mode") : tr("dark_mode");

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
