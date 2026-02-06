import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Star, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SpaceFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spaceTitle: string;
}

export const SpaceFeedbackModal = ({
  isOpen,
  onClose,
  spaceId,
  spaceTitle,
}: SpaceFeedbackModalProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please log in to submit feedback');
      return;
    }

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('space_feedback').insert({
        space_id: spaceId,
        user_id: user.id,
        rating,
        feedback: feedback.trim() || null,
      });

      if (error) throw error;

      toast.success('Thank you for your feedback!');
      setRating(0);
      setFeedback('');
      onClose();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast.error(error.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const displayRating = hoveredRating || rating;

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
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl"
          >
            {/* Handle bar */}
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mt-4 mb-2" />

            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-white text-lg font-bold">Share Feedback</h2>
                <p className="text-zinc-500 text-sm truncate max-w-[200px]">{spaceTitle}</p>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
              {/* Star Rating */}
              <div className="text-center">
                <p className="text-zinc-400 text-sm mb-3">How was your experience?</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          star <= displayRating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-purple-400 text-sm mt-2"
                  >
                    {rating === 5
                      ? 'Excellent!'
                      : rating === 4
                      ? 'Great!'
                      : rating === 3
                      ? 'Good'
                      : rating === 2
                      ? 'Could be better'
                      : 'Poor experience'}
                  </motion.p>
                )}
              </div>

              {/* Feedback textarea */}
              <div>
                <label className="text-zinc-400 text-sm mb-2 block">
                  Additional comments (optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us more about your experience..."
                  rows={3}
                  maxLength={500}
                  className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
                <p className="text-zinc-600 text-xs text-right mt-1">
                  {feedback.length}/500
                </p>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={loading || rating === 0}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>

            {/* Safe area padding */}
            <div className="pb-safe" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
