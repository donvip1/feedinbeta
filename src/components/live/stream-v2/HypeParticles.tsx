import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStreamStore } from '@/stores/useStreamStore';

interface Particle {
  id: number;
  x: number;
  emoji: string;
}

const EMOJIS = ['🔥', '✨', '💎', '🚀'];

export const HypeParticles = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const hypeLevel = useStreamStore((s) => s.hypeLevel);

  useEffect(() => {
    const spawnRate = hypeLevel > 70 ? 300 : hypeLevel > 40 ? 500 : 800;
    const interval = setInterval(() => {
      if (Math.random() > (hypeLevel > 50 ? 0.3 : 0.7)) {
        const id = Math.random();
        setParticles(prev => [...prev, { id, x: Math.random() * 100, emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 2000);
      }
    }, spawnRate);
    return () => clearInterval(interval);
  }, [hypeLevel]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      <AnimatePresence>
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '-10%', opacity: [0, 1, 0] }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute text-2xl"
            style={{ left: `${p.x}%` }}
          >
            {p.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
