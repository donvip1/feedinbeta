import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, Link as LinkIcon } from 'lucide-react';
import { useStreamStore } from '@/stores/useStreamStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AICatchUpPanelProps {
  streamId: string;
}

export const AICatchUpPanel = ({ streamId }: AICatchUpPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const aiSummary = useStreamStore((s) => s.aiSummary);
  const setAISummary = useStreamStore((s) => s.setAISummary);

  const fetchSummary = async () => {
    setAISummary({ bullets: [], pinnedLinks: [], generatedAt: '', loading: true });
    setIsOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('stream-ai-summary', {
        body: { streamId },
      });

      if (error) throw error;

      setAISummary({
        bullets: data?.bullets || ['No recent activity to summarize.'],
        pinnedLinks: data?.pinnedLinks || [],
        hotTopic: data?.hotTopic || '',
        sentimentScore: data?.sentimentScore ?? 0,
        sentimentLabel: data?.sentimentLabel || 'Neutral',
        generatedAt: new Date().toISOString(),
        loading: false,
      });
    } catch (err: any) {
      console.error('AI summary error:', err);
      toast.error('Failed to generate summary');
      setAISummary({
        bullets: ['Could not generate summary. Try again later.'],
        pinnedLinks: [],
        generatedAt: new Date().toISOString(),
        loading: false,
      });
    }
  };

  const sentimentColor = aiSummary?.sentimentLabel === 'Positive' ? 'bg-green-500' : aiSummary?.sentimentLabel === 'Negative' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <>
      <button
        onClick={fetchSummary}
        className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all hover:bg-yellow-400 hover:text-black"
        title="PULSE"
      >
        <Sparkles className="w-3 h-3 text-yellow-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/50"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-black/80 backdrop-blur-[50px] border-l border-white/10 flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between pt-safe">
                <h2 className="text-2xl font-black italic flex items-center gap-2 tracking-tighter text-white">
                  <Sparkles className="text-yellow-400 w-6 h-6" /> PULSE
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-white/5">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {aiSummary?.loading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
                    <p className="text-white/40 text-sm">Analyzing last 15 minutes...</p>
                  </div>
                ) : (
                  <>
                    {/* Hot Topic */}
                    {aiSummary?.hotTopic && (
                      <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                        <p className="text-[10px] font-black uppercase text-yellow-400 tracking-widest mb-3">Hot Topic</p>
                        <p className="text-sm font-bold italic leading-relaxed text-white">{aiSummary.hotTopic}</p>
                      </div>
                    )}

                    {/* Sentiment & Engagement */}
                    <div className="flex flex-col gap-3">
                      <div className="h-12 w-full bg-white/5 rounded-2xl flex items-center px-4 gap-3">
                        <div className={`w-2 h-2 rounded-full ${sentimentColor}`} />
                        <span className="text-[10px] font-black uppercase text-white/80">
                          Sentiment: {aiSummary?.sentimentScore ?? 0}% {aiSummary?.sentimentLabel || 'Neutral'}
                        </span>
                      </div>
                      <div className="h-12 w-full bg-white/5 rounded-2xl flex items-center px-4 gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-black uppercase text-white/80">Active Engagement</span>
                      </div>
                    </div>

                    {/* Summary bullets */}
                    <div>
                      <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Last 15 Minutes</h3>
                      <div className="space-y-3">
                        {aiSummary?.bullets.map((bullet, i) => (
                          <div
                            key={i}
                            className="flex gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5"
                          >
                            <span className="text-yellow-400 font-black text-sm mt-0.5">•</span>
                            <p className="text-white/80 text-sm leading-relaxed">{bullet}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pinned links */}
                    {aiSummary?.pinnedLinks && aiSummary.pinnedLinks.length > 0 && (
                      <div>
                        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Mentioned Links</h3>
                        <div className="space-y-2">
                          {aiSummary.pinnedLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                            >
                              <LinkIcon className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="text-blue-300 text-sm truncate">{link}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiSummary?.generatedAt && (
                      <p className="text-white/20 text-[10px] text-center">
                        Generated at {new Date(aiSummary.generatedAt).toLocaleTimeString()}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
