import { Home, ScanLine, History, Sparkles, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const navItems = [
    { icon: Home, label: t.home, path: "/" },
    { icon: History, label: "History", path: "/scan/history" },
    { icon: ScanLine, label: "Scan", path: "/scan", primary: true },
    { icon: Sparkles, label: "Insights", path: "/insights" },
    { icon: User, label: t.profile, path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-card/80 backdrop-blur-2xl border-t border-border/50">
        <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            if (item.primary) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="relative -mt-7 flex flex-col items-center"
                  aria-label={item.label}
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary via-health-calories to-health-heart flex items-center justify-center shadow-xl ring-4 ring-background">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className={`text-[10px] font-semibold mt-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                </button>
              );
            }
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 py-1 px-1.5"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-2 w-5 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className="h-safe-area-inset-bottom" />
      </div>
    </div>
  );
};

export default BottomNav;
