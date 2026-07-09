import { useState, useEffect, useCallback } from "react";

// Simple sunrise/sunset calculation (approximation)
function getSunTimes(lat: number, lng: number, date: Date): { sunrise: number; sunset: number } {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const decl = -23.45 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));
  const latRad = lat * rad;
  const declRad = decl * rad;
  const cosHA = -(Math.tan(latRad) * Math.tan(declRad));
  const clampedCos = Math.max(-1, Math.min(1, cosHA));
  const haDeg = Math.acos(clampedCos) / rad;
  const solarNoon = 12 - lng / 15;
  const sunrise = solarNoon - haDeg / 15;
  const sunset = solarNoon + haDeg / 15;
  // Convert to local hours by adding timezone offset
  const tzOffset = -date.getTimezoneOffset() / 60;
  return {
    sunrise: ((sunrise + tzOffset) % 24 + 24) % 24,
    sunset: ((sunset + tzOffset) % 24 + 24) % 24,
  };
}

export type ThemeMode = "auto-sun" | "auto-hours" | "manual";

export interface ThemeSettings {
  mode: ThemeMode;
  lightStart: number; // hour 0-23
  lightEnd: number;   // hour 0-23
  manualTheme: "light" | "dark";
  lat: number | null;
  lng: number | null;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  mode: "auto-sun",
  lightStart: 8,
  lightEnd: 18,
  manualTheme: "dark",
  lat: null,
  lng: null,
};

function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem("themeSettings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
    // Migrate old settings
    const isManual = localStorage.getItem("themeManual") === "true";
    if (isManual) {
      const old = (localStorage.getItem("theme") as "light" | "dark") || "dark";
      return { ...DEFAULT_SETTINGS, mode: "manual", manualTheme: old };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(s: ThemeSettings) {
  localStorage.setItem("themeSettings", JSON.stringify(s));
}

function resolveTheme(s: ThemeSettings): "light" | "dark" {
  if (s.mode === "manual") return s.manualTheme;
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  if (s.mode === "auto-hours") {
    return hour >= s.lightStart && hour < s.lightEnd ? "light" : "dark";
  }
  // auto-sun
  if (s.lat != null && s.lng != null) {
    const { sunrise, sunset } = getSunTimes(s.lat, s.lng, new Date());
    return hour >= sunrise && hour < sunset ? "light" : "dark";
  }
  // fallback to hours if no location
  return hour >= s.lightStart && hour < s.lightEnd ? "light" : "dark";
}

export const useTheme = () => {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);
  const [theme, setThemeState] = useState<"light" | "dark">(() => resolveTheme(loadSettings()));

  // Request geolocation on mount if auto-sun and no coords
  useEffect(() => {
    if (settings.mode === "auto-sun" && settings.lat == null && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSettings((prev) => {
            const next = { ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude };
            saveSettings(next);
            return next;
          });
        },
        () => {} // silently fail, use fallback hours
      );
    }
  }, [settings.mode]);

  // Apply theme to DOM immediately when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
    // Dispatch custom event for cross-component sync
    window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: theme }));
  }, [theme]);

  // Listen for theme changes from other components/tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "themeSettings") {
        const newSettings = loadSettings();
        setSettings(newSettings);
        setThemeState(resolveTheme(newSettings));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Auto-switch every minute when not manual
  useEffect(() => {
    if (settings.mode === "manual") return;
    const tick = () => setThemeState(resolveTheme(settings));
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [settings]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => {
      const next: ThemeSettings = {
        ...prev,
        mode: "manual",
        manualTheme: prev.manualTheme === "dark" ? "light" : "dark",
      };
      saveSettings(next);
      return next;
    });
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const updateSettings = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      setThemeState(resolveTheme(next));
      return next;
    });
  }, []);

  return { theme, toggleTheme, settings, updateSettings };
};
