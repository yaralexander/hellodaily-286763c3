import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  unit: string;
  subtitle?: string;
  variant: "activity" | "heart" | "sleep" | "nutrition";
  progress?: number;
}

const variantStyles = {
  activity: "text-health-activity metric-glow-activity",
  heart: "text-health-heart metric-glow-heart",
  sleep: "text-health-sleep metric-glow-sleep",
  nutrition: "text-health-nutrition metric-glow-nutrition",
};

const progressColors = {
  activity: "bg-health-activity",
  heart: "bg-health-heart",
  sleep: "bg-health-sleep",
  nutrition: "bg-health-nutrition",
};

const MetricCard = ({ icon: Icon, label, value, unit, subtitle, variant, progress }: MetricCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-4 ${variantStyles[variant]}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-sm font-medium opacity-60">{unit}</span>
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            className={`h-full rounded-full ${progressColors[variant]}`}
          />
        </div>
      )}
    </motion.div>
  );
};

export default MetricCard;
