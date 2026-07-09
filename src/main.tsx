import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme before render to prevent flash
try {
  const raw = localStorage.getItem("themeSettings");
  let dark = true;
  if (raw) {
    const s = JSON.parse(raw);
    if (s.mode === "manual") {
      dark = s.manualTheme === "dark";
    } else {
      const hour = new Date().getHours();
      const start = s.lightStart ?? 8;
      const end = s.lightEnd ?? 18;
      dark = !(hour >= start && hour < end);
    }
  } else {
    // legacy fallback
    const isManual = localStorage.getItem("themeManual") === "true";
    const hour = new Date().getHours();
    dark = isManual
      ? localStorage.getItem("theme") === "dark"
      : !(hour >= 8 && hour < 18);
  }
  if (dark) document.documentElement.classList.add("dark");
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
