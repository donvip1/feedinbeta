import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Shield, Users, Heart, AlertCircle, CheckCircle } from 'lucide-react';

interface SpaceRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPACE_RULES = [
  {
    icon: Shield,
    title: 'Be Respectful',
    description: 'Treat all participants with kindness and respect. Personal attacks, insults, or harassment will not be tolerated.',
  },
  {
    icon: AlertCircle,
    title: 'No Hate Speech',
    description: 'Discrimination based on race, gender, religion, sexuality, or any other characteristic is strictly prohibited.',
  },
  {
    icon: Users,
    title: 'Stay On Topic',
    description: 'Keep discussions relevant to the Space topic. Off-topic conversations may be redirected by hosts.',
  },
  {
    icon: Heart,
    title: 'Support Each Other',
    description: 'Encourage constructive dialogue. Support fellow participants and contribute positively to the community.',
  },
  {
    icon: CheckCircle,
    title: 'Follow Platform Guidelines',
    description: 'Adhere to all platform Terms of Service and Community Guidelines at all times.',
  },
];

export const SpaceRulesModal = ({ isOpen, onClose }: SpaceRulesModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl max-h-[80vh] overflow-hidden"
          >
            {/* Handle bar */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mt-4 mb-2" />
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold">Space Rules</h2>
                <p className="text-zinc-500 text-sm">Community guidelines for this Space</p>
              </div>
            </div>

            {/* Rules list */}
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh] pb-safe">
              <div className="space-y-4">
                {SPACE_RULES.map((rule, index) => (
                  <motion.div
                    key={rule.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 p-4 bg-zinc-800/50 rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <rule.icon className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{rule.title}</h3>
                      <p className="text-zinc-400 text-sm leading-relaxed">{rule.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-zinc-800">
                <p className="text-zinc-500 text-xs text-center">
                  Violations may result in removal from the Space or account restrictions.
                </p>
              </div>
            </div>

            {/* Close button */}
            <div className="px-6 pb-6 pb-safe">
              <button
                onClick={onClose}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
