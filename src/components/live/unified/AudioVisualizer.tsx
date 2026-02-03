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
  color = "bg-primary"
}: AudioVisualizerProps) => {
  return (
    <div className={cn("flex items-end justify-center gap-1 h-16", className)}>
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className={cn("w-2 rounded-full", color)}
          animate={{
            height: active ? [16, 48, 24, 56, 32] : 16,
          }}
          transition={{
            duration: 0.8,
            repeat: active ? Infinity : 0,
            repeatType: "reverse",
            delay: i * 0.1,
            ease: "easeInOut",
          }}
          style={{ minHeight: 16 }}
        />
      ))}
    </div>
  );
};
