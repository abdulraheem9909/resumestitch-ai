import { useEffect, useState } from "react";

function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  // Always start in light mode regardless of the OS's own dark-mode setting —
  // dark mode is opt-in via the toggle, not inherited from the system.
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return { theme, toggleTheme };
}
