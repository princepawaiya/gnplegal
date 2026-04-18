import { useEffect, useState } from "react";

export default function CounselThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "light";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  function applyTheme(mode) {
    const root = document.documentElement;

    if (mode === "dark") {
      root.style.setProperty("--bg", "#0f172a");
      root.style.setProperty("--card", "#1e293b");
      root.style.setProperty("--text", "#f1f5f9");
      root.style.setProperty("--subtext", "#94a3b8");
    } else {
      root.style.setProperty("--bg", "#f8fafc");
      root.style.setProperty("--card", "#ffffff");
      root.style.setProperty("--text", "#0f172a");
      root.style.setProperty("--subtext", "#64748b");
    }
  }

  function toggleTheme() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  }

  return (
    <button style={styles.button} onClick={toggleTheme}>
      {theme === "light" ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}

/* ================= STYLES ================= */

const styles = {
  button: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
};