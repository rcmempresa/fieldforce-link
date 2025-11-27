import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface TimeTrackerProps {
  startTime: string;
  className?: string;
}

export function TimeTracker({ startTime, className = "" }: TimeTrackerProps) {
  const [elapsed, setElapsed] = useState<string>("00:00:00");

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className={`flex items-center gap-1.5 text-primary font-mono ${className}`}>
      <Clock className="h-4 w-4 animate-pulse" />
      <span className="font-semibold">{elapsed}</span>
    </div>
  );
}
