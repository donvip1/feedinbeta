import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Crown, Code, Star, Sparkles, Zap } from 'lucide-react';

interface BadgeCelebrationProps {
  type: 'role_promotion' | 'plan_upgrade';
  title: string;
  message?: string;
  onComplete: () => void;
}

const BADGE_ICONS: Record<string, React.ElementType> = {
  'super_admin': Crown,
  'developer': Code,
  'admin': Shield,
  'moderator': Star,
  'premium': Crown,
  'pro': Sparkles,
  'popular': Zap,
};

const BADGE_GRADIENTS: Record<string, string> = {
  'super_admin': 'from-amber-500 via-red-500 to-orange-500',
  'developer': 'from-violet-500 via-purple-600 to-indigo-500',
  'admin': 'from-blue-500 via-cyan-500 to-teal-500',
  'moderator': 'from-green-500 via-emerald-500 to-teal-500',
  'premium': 'from-yellow-500 via-orange-500 to-amber-500',
  'pro': 'from-purple-500 via-pink-500 to-rose-500',
  'popular': 'from-blue-500 via-indigo-500 to-purple-500',
};

export const BadgeCelebration = ({ type, title, message, onComplete }: BadgeCelebrationProps) => {
  const [show, setShow] = useState(true);

  // Detect which badge to show from the title
  const detectBadge = () => {
    const titleLower = title.toLowerCase();
    for (const key of Object.keys(BADGE_ICONS)) {
      if (titleLower.includes(key.replace('_', ' ')) || titleLower.includes(key)) {
        return key;
      }
    }
    return type === 'role_promotion' ? 'moderator' : 'popular';
  };

  const badgeKey = detectBadge();
  const Icon = BADGE_ICONS[badgeKey] || Star;
  const gradient = BADGE_GRADIENTS[badgeKey] || 'from-primary to-accent';

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 3500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Generate particle positions
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i * 30) * (Math.PI / 180),
    delay: i * 0.05,
  }));

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setShow(false); setTimeout(onComplete, 500); }}
        >
          {/* Particle burst */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos(p.angle) * 160,
                y: Math.sin(p.angle) * 160,
                scale: [0, 1.5, 0],
              }}
              transition={{ duration: 1.5, delay: 0.3 + p.delay, ease: 'easeOut' }}
              className={`absolute w-3 h-3 rounded-full bg-gradient-to-r ${gradient}`}
            />
          ))}

          {/* Badge pop-out */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: [0, 1.3, 1], rotate: [-180, 10, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col items-center gap-4"
          >
            {/* Glowing badge icon */}
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px rgba(255,255,255,0.3)',
                  '0 0 60px rgba(255,255,255,0.6)',
                  '0 0 20px rgba(255,255,255,0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-28 h-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl`}
            >
              <Icon className="w-14 h-14 text-white drop-shadow-lg" />
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-center"
            >
              <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
              {message && (
                <p className="text-sm text-white/80 max-w-xs">{message}</p>
              )}
            </motion.div>

            {/* Tap to dismiss */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-xs text-white/50 mt-4"
            >
              Tap anywhere to dismiss
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
