import { ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const ScanFoodButton = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const ru = language === "ru";
  if (compact) {
    return (
      <button
        onClick={() => navigate("/scan")}
        className="w-full glass-card p-4 flex items-center gap-3 hover:bg-card/70 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-health-calories flex items-center justify-center shadow-lg">
          <ScanLine className="w-5 h-5 text-white" />
        </div>
        <div className="text-left flex-1">
          <p className="text-sm font-semibold text-foreground">{ru ? "Сканировать еду" : "Scan Food"}</p>
          <p className="text-[10px] text-muted-foreground">{ru ? "Штрихкод · Упаковка · Блюдо" : "Barcode · Package · Meal"}</p>
        </div>
      </button>
    );
  }
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate("/scan")}
      className="w-full p-5 rounded-2xl bg-gradient-to-br from-primary via-health-calories to-health-heart text-white flex items-center justify-between shadow-xl"
      style={{ boxShadow: "0 12px 40px -8px hsl(var(--primary) / 0.5)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
          <ScanLine className="w-6 h-6" />
        </div>
        <div className="text-left">
          <p className="text-base font-bold">{ru ? "Сканировать еду" : "Scan Food"}</p>
          <p className="text-[11px] opacity-90">{ru ? "Мгновенно проверьте состав продукта" : "Instantly check how healthy it is"}</p>
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-wider bg-white/15 px-3 py-1.5 rounded-full">{ru ? "Новое" : "New"}</span>
    </motion.button>
  );
};

export default ScanFoodButton;
