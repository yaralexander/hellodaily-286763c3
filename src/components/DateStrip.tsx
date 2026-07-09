import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday, isSameDay } from "date-fns";

interface DateStripProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  daysToShow?: number;
}

const DateStrip = ({ selectedDate, onDateChange, daysToShow = 14 }: DateStripProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Generate dates: 7 days before today to 6 days after
  const today = new Date();
  const dates: Date[] = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    dates.push(subDays(today, i));
  }

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedDate]);

  const goBack = () => onDateChange(subDays(selectedDate, 1));
  const goForward = () => {
    if (!isToday(selectedDate)) onDateChange(addDays(selectedDate, 1));
  };

  return (
    <div className="flex items-center gap-1 mb-4">
      <button
        onClick={goBack}
        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0"
      >
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide flex-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {dates.map((date) => {
          const selected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          return (
            <button
              key={date.toISOString()}
              ref={selected ? selectedRef : undefined}
              onClick={() => onDateChange(date)}
              className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl shrink-0 transition-colors min-w-[44px] ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : isTodayDate
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-[9px] font-medium uppercase">
                {format(date, "EEE")}
              </span>
              <span className={`text-sm font-bold ${selected ? "" : ""}`}>
                {format(date, "d")}
              </span>
              <span className="text-[8px]">
                {format(date, "MMM")}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={goForward}
        disabled={isToday(selectedDate)}
        className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 disabled:opacity-30"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default DateStrip;
