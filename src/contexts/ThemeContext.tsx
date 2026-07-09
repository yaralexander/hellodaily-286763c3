import { createContext, useContext, ReactNode } from "react";
import { useTheme, ThemeMode, ThemeSettings } from "@/hooks/useTheme";

type ThemeContextType = {
  theme: "light" | "dark";
  toggleTheme: () => void;
  settings: ThemeSettings;
  updateSettings: (partial: Partial<ThemeSettings>) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const themeState = useTheme();

  return (
    <ThemeContext.Provider value={themeState}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return context;
};
