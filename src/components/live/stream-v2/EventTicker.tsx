import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventTickerProps {
  latestEvent?: string;
}

const DEFAULT_EVENTS = [
  "⚡️ WELCOME TO THE ARENA",
  "🔥 HYPE TRAIN BUILDING",
  "✨ NEW VIEWERS JOINING",
];

export const EventTicker = ({ latestEvent }: EventTickerProps) => {
  const [event, setEvent] = useState(latestEvent || DEFAULT_EVENTS[0]);

  useEffect(() => {
    if (latestEvent) { setEvent(latestEvent); return; }
    const interval = setInterval(() => {
      setEvent(DEFAULT_EVENTS[Math.floor(Math.random() * DEFAULT_EVENTS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [latestEvent]);

  return (
    <div className="absolute top-[68px] right-3 z-20 pointer-events-none pt-safe">
      <AnimatePresence mode="wait">
        <motion.div
          key={event}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -50, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white text-black px-2.5 py-1 rounded-full text-[8px] font-black italic shadow-[0_0_15px_rgba(255,255,255,0.2)] max-w-[140px] truncate"
        >
          {event}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
