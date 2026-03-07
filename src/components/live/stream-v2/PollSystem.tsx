import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { useStreamStore, type StreamPoll } from '@/stores/useStreamStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PollSystemProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
}

export const PollSystem = ({ isOpen, onClose, streamId }: PollSystemProps) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const addPoll = useStreamStore((s) => s.addPoll);

  const addOption = () => {
    if (options.length < 4) setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    const trimmedQ = question.trim();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!trimmedQ || validOptions.length < 2) {
      toast.error('Need a question and at least 2 options');
      return;
    }

    const pollId = crypto.randomUUID();
    const pollOptions = validOptions.map((text, i) => ({
      id: `opt-${i}-${Date.now()}`,
      text,
      votes: 0,
    }));

    const newPoll: StreamPoll = {
      id: pollId,
      question: trimmedQ,
      options: pollOptions,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    addPoll(newPoll);

    // Broadcast poll to all viewers
    supabase.channel(`stream-polls-${streamId}`).send({
      type: 'broadcast',
      event: 'new_poll',
      payload: newPoll,
    });

    // Persist to DB
    const supabaseAny = supabase as any;
    supabaseAny.from('stream_polls').insert({
      id: pollId,
      stream_id: streamId,
      question: trimmedQ,
      options: pollOptions,
      votes: {},
      is_active: true,
    });

    toast.success('Poll created!');
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-full max-w-md bg-[#0F1119] rounded-t-[2rem] p-6 pb-safe border-t border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-black text-lg">Create Poll</h3>
              <button onClick={onClose} className="p-2 bg-white/5 rounded-full">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Question */}
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="w-full bg-white/5 text-white placeholder-white/30 rounded-xl px-4 py-3 outline-none border border-white/5 focus:border-purple-500/50 text-sm mb-4"
              maxLength={120}
            />

            {/* Options */}
            <div className="space-y-2 mb-4">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-white/5 text-white placeholder-white/30 rounded-xl px-4 py-2.5 outline-none border border-white/5 focus:border-purple-500/50 text-sm"
                    maxLength={60}
                  />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="p-2 text-white/30 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 4 && (
              <button
                onClick={addOption}
                className="flex items-center gap-2 text-purple-400 text-sm font-medium mb-5 hover:text-purple-300"
              >
                <Plus className="w-4 h-4" />
                Add option
              </button>
            )}

            <button
              onClick={handleCreate}
              disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl transition-all active:scale-[0.98]"
            >
              Launch Poll
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
