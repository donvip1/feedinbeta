import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PredictionSystemProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  isHost: boolean;
  userCredits: number;
}

export const PredictionSystem = ({ isOpen, onClose, streamId, isHost, userCredits }: PredictionSystemProps) => {
  const [question, setQuestion] = useState('');
  const [outcomeA, setOutcomeA] = useState('');
  const [outcomeB, setOutcomeB] = useState('');
  const [wagerAmount, setWagerAmount] = useState(10);
  const [selectedOutcome, setSelectedOutcome] = useState<'a' | 'b' | null>(null);
  const [activePrediction, setActivePrediction] = useState<any>(null);

  const handleCreatePrediction = () => {
    if (!question.trim() || !outcomeA.trim() || !outcomeB.trim()) {
      toast.error('Fill in all fields');
      return;
    }

    const prediction = {
      id: crypto.randomUUID(),
      question,
      outcomes: [
        { id: 'a', text: outcomeA, pool: 0, bettors: 0 },
        { id: 'b', text: outcomeB, pool: 0, bettors: 0 },
      ],
    };

    // Broadcast prediction to all viewers
    supabase.channel(`stream-events-${streamId}`).send({
      type: 'broadcast',
      event: 'new_prediction',
      payload: prediction,
    });

    setActivePrediction(prediction);
    toast.success('Prediction created!');
    setQuestion('');
    setOutcomeA('');
    setOutcomeB('');
  };

  const handlePlaceBet = () => {
    if (!selectedOutcome || wagerAmount <= 0) return;
    if (wagerAmount > userCredits) {
      toast.error('Not enough credits');
      return;
    }

    supabase.channel(`stream-events-${streamId}`).send({
      type: 'broadcast',
      event: 'prediction_bet',
      payload: { outcomeId: selectedOutcome, amount: wagerAmount },
    });

    toast.success(`Wagered ${wagerAmount} credits on "${selectedOutcome === 'a' ? outcomeA || 'Option A' : outcomeB || 'Option B'}"`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[55] bg-black/60 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-lg bg-black/90 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-6 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <h2 className="text-white font-black text-lg">Predictions</h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {isHost ? (
              <div className="space-y-4">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What's the prediction?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-green-500/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={outcomeA}
                    onChange={(e) => setOutcomeA(e.target.value)}
                    placeholder="Outcome A"
                    className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
                  />
                  <input
                    value={outcomeB}
                    onChange={(e) => setOutcomeB(e.target.value)}
                    placeholder="Outcome B"
                    className="bg-pink-500/10 border border-pink-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-pink-500/50"
                  />
                </div>
                <button
                  onClick={handleCreatePrediction}
                  disabled={!question.trim() || !outcomeA.trim() || !outcomeB.trim()}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  Start Prediction
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/60 text-sm text-center">
                  {activePrediction ? activePrediction.question : 'Waiting for host to create a prediction...'}
                </p>
                {activePrediction && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {activePrediction.outcomes.map((o: any) => (
                        <button
                          key={o.id}
                          onClick={() => setSelectedOutcome(o.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            selectedOutcome === o.id
                              ? 'border-green-400 bg-green-500/20'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <p className="text-white font-bold text-sm">{o.text}</p>
                          <p className="text-white/40 text-xs mt-1">{o.pool} credits pooled</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                        <Coins className="w-4 h-4 text-amber-400 mr-2" />
                        <input
                          type="number"
                          value={wagerAmount}
                          onChange={(e) => setWagerAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="bg-transparent text-white text-sm font-bold w-full focus:outline-none"
                          min={1}
                        />
                      </div>
                      <button
                        onClick={handlePlaceBet}
                        disabled={!selectedOutcome}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
                      >
                        Wager
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
