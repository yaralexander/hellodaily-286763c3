import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const COLOR_FOR = (s: number) =>
  s >= 90 ? "hsl(142 70% 42%)" :
  s >= 80 ? "hsl(142 60% 48%)" :
  s >= 70 ? "hsl(95 60% 48%)" :
  s >= 60 ? "hsl(50 95% 50%)" :
  s >= 40 ? "hsl(28 95% 55%)" :
            "hsl(0 80% 55%)";

const LABEL_FOR = (s: number) =>
  s >= 95 ? "Exceptional" : s >= 90 ? "Excellent" : s >= 80 ? "Very Good" :
  s >= 70 ? "Good" : s >= 60 ? "Acceptable" : s >= 40 ? "Occasional" : "Poor";

interface Props {
  score: number;
  /** Optional override; defaults to canonical V2 label by score. */
  category?: string;
  size?: number;
  title?: string;
}

const HealthScoreRing = ({ score, category, size = 220, title = "Hello Daily Score" }: Props) => {
  const [animated, setAnimated] = useState(0);
  const color = COLOR_FOR(score);
  const label = category && /excellent|very good|good|exceptional|acceptable|occasional|poor/i.test(category)
    ? category.charAt(0).toUpperCase() + category.slice(1)
    : LABEL_FOR(score);
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (animated / 100) * circ;

  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(Math.round(eased * score));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 200 200" className="-rotate-90">
        <defs>
          <linearGradient id={`hd-grad-${title.replace(/\s/g,"")}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="14" />
        <motion.circle
          cx="100" cy="100" r={radius} fill="none"
          stroke={`url(#hd-grad-${title.replace(/\s/g,"")})`} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 12px ${color}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{title}</span>
        <span className="text-5xl font-extrabold text-foreground leading-none mt-1" style={{ color }}>{animated}</span>
        <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
        <span className="text-[11px] font-semibold mt-1.5" style={{ color }}>{label}</span>
      </div>
    </div>
  );
};

export default HealthScoreRing;
