import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2, Link as LinkIcon, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useStreamStore } from '@/stores/useStreamStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HostCard {
  id: string;
  emoji: string;
  title: string;
  body: string;
  link?: string;
}

interface AICatchUpPanelProps {
  streamId: string;
  isHost?: boolean;
  hostCards?: HostCard[];
  onUpdateCards?: (cards: HostCard[]) => void;
}

const CARD_EMOJIS = ['🔥', '🎁', '💎', '🎯', '🛍️', '📢', '🎶', '⚡', '🏷️', '💰'];

export const AICatchUpPanel = ({ streamId, isHost = false, hostCards = [], onUpdateCards }: AICatchUpPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCard, setNewCard] = useState<Omit<HostCard, 'id'>>({ emoji: '🔥', title: '', body: '' });
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

  const handleAddCard = () => {
    if (!newCard.title.trim()) return;
    const card: HostCard = { ...newCard, id: crypto.randomUUID() };
    const updated = [...hostCards, card];
    onUpdateCards?.(updated);
    setNewCard({ emoji: '🔥', title: '', body: '' });
    setIsAddingCard(false);
    toast.success('Card added!');
  };

  const handleRemoveCard = (id: string) => {
    onUpdateCards?.(hostCards.filter(c => c.id !== id));
  };

  const sentimentColor = aiSummary?.sentimentLabel === 'Positive' ? 'bg-green-500' : aiSummary?.sentimentLabel === 'Negative' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <>
      <button
        onClick={fetchSummary}
        className="w-7 h-7 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all hover:bg-yellow-400 hover:text-black relative"
        title="PULSE"
      >
        <Sparkles className="w-3 h-3 text-yellow-400" />
        {hostCards.length > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 rounded-full text-[7px] font-black text-black flex items-center justify-center">
            {hostCards.length}
          </span>
        )}
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
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between pt-safe">
                <h2 className="text-xl font-black italic flex items-center gap-2 tracking-tighter text-white">
                  <Sparkles className="text-yellow-400 w-5 h-5" /> PULSE
                </h2>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-white/5">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-safe">

                {/* ====== HOST CARDS SECTION ====== */}
                {(hostCards.length > 0 || isHost) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">Host Spotlight</p>
                      {isHost && (
                        <button
                          onClick={() => setIsAddingCard(true)}
                          className="flex items-center gap-1 text-[10px] font-bold text-yellow-400/80 hover:text-yellow-400 transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      )}
                    </div>

                    {/* Add Card Form */}
                    <AnimatePresence>
                      {isAddingCard && isHost && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mb-3"
                        >
                          <div className="bg-white/5 border border-yellow-400/20 rounded-2xl p-3 space-y-2.5">
                            {/* Emoji picker */}
                            <div className="flex gap-1.5 flex-wrap">
                              {CARD_EMOJIS.map(e => (
                                <button
                                  key={e}
                                  onClick={() => setNewCard(c => ({ ...c, emoji: e }))}
                                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                                    newCard.emoji === e ? 'bg-yellow-400/20 ring-1 ring-yellow-400 scale-110' : 'bg-white/5 hover:bg-white/10'
                                  }`}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                            <input
                              value={newCard.title}
                              onChange={e => setNewCard(c => ({ ...c, title: e.target.value }))}
                              placeholder="Title (e.g. 'Blue Hoodie Drop')"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/40"
                              maxLength={60}
                              style={{ fontSize: '16px' }}
                            />
                            <textarea
                              value={newCard.body}
                              onChange={e => setNewCard(c => ({ ...c, body: e.target.value }))}
                              placeholder="Details (optional)"
                              rows={2}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/40 resize-none"
                              maxLength={200}
                              style={{ fontSize: '16px' }}
                            />
                            <input
                              value={newCard.link || ''}
                              onChange={e => setNewCard(c => ({ ...c, link: e.target.value }))}
                              placeholder="Link (optional)"
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/40"
                              style={{ fontSize: '16px' }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setIsAddingCard(false); setNewCard({ emoji: '🔥', title: '', body: '' }); }}
                                className="flex-1 py-1.5 rounded-xl bg-white/5 text-white/60 text-xs font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleAddCard}
                                disabled={!newCard.title.trim()}
                                className="flex-1 py-1.5 rounded-xl bg-yellow-400 text-black text-xs font-black disabled:opacity-30"
                              >
                                Publish
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Cards list */}
                    <div className="space-y-2.5">
                      {hostCards.map((card, i) => (
                        <motion.div
                          key={card.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl p-3.5 relative group"
                        >
                          {isHost && (
                            <button
                              onClick={() => handleRemoveCard(card.id)}
                              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl mt-0.5">{card.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black italic text-white leading-tight">{card.title}</p>
                              {card.body && (
                                <p className="text-xs text-white/50 mt-1 leading-relaxed">{card.body}</p>
                              )}
                              {card.link && (
                                <a
                                  href={card.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-yellow-400 hover:text-yellow-300 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" /> Open Link
                                </a>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {hostCards.length === 0 && isHost && !isAddingCard && (
                      <p className="text-white/20 text-xs text-center py-4 italic">
                        Add announcements, promo codes, or highlights for your viewers
                      </p>
                    )}
                  </div>
                )}

                {/* Divider between host cards and AI */}
                {hostCards.length > 0 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}

                {/* ====== AI SECTION ====== */}
                {aiSummary?.loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-7 h-7 text-yellow-400 animate-spin" />
                    <p className="text-white/40 text-xs">Analyzing last 15 minutes...</p>
                  </div>
                ) : (
                  <>
                    {/* Hot Topic */}
                    {aiSummary?.hotTopic && (
                      <div className="bg-white/5 p-3.5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black uppercase text-yellow-400 tracking-widest mb-2">Hot Topic</p>
                        <p className="text-sm font-bold italic leading-relaxed text-white">{aiSummary.hotTopic}</p>
                      </div>
                    )}

                    {/* Sentiment & Engagement */}
                    <div className="flex flex-col gap-2">
                      <div className="h-10 w-full bg-white/5 rounded-xl flex items-center px-3 gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${sentimentColor}`} />
                        <span className="text-[10px] font-black uppercase text-white/80">
                          Sentiment: {aiSummary?.sentimentScore ?? 0}% {aiSummary?.sentimentLabel || 'Neutral'}
                        </span>
                      </div>
                      <div className="h-10 w-full bg-white/5 rounded-xl flex items-center px-3 gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-[10px] font-black uppercase text-white/80">Active Engagement</span>
                      </div>
                    </div>

                    {/* Summary bullets */}
                    <div>
                      <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Last 15 Minutes</h3>
                      <div className="space-y-2">
                        {aiSummary?.bullets.map((bullet, i) => (
                          <div
                            key={i}
                            className="flex gap-2.5 p-2.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5"
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
                        <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Mentioned Links</h3>
                        <div className="space-y-1.5">
                          {aiSummary.pinnedLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
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
