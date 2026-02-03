import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
  className?: string;
  color?: string;
}

export const AudioVisualizer = ({ 
  active, 
  barCount = 5, 
  className,
  color = "bg-white"
}: AudioVisualizerProps) => {
  return (
    <div className={cn("flex items-end justify-center gap-1 h-8", className)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className={cn("w-1 rounded-full", color)}
          animate={{
            height: active 
              ? [8, 32, 16, 24, 12, 28, 8] 
              : 8,
          }}
          transition={{
            duration: 1.2,
            repeat: active ? Infinity : 0,
            repeatType: "loop",
            delay: i * 0.15,
            ease: "easeInOut",
          }}
          style={{ minHeight: 8 }}
        />
      ))}
    </div>
  );
};