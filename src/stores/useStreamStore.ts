import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface StreamPoll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  createdAt: string;
  votedOptionId?: string;
}

export interface AISummary {
  bullets: string[];
  pinnedLinks: string[];
  hotTopic?: string;
  sentimentScore?: number;
  sentimentLabel?: string;
  generatedAt: string;
  loading: boolean;
}

export interface StreamStoreState {
  // POV / Camera angles
  activeAngleId: string | null;
  setActiveAngleId: (id: string | null) => void;

  // Polls
  polls: StreamPoll[];
  addPoll: (poll: StreamPoll) => void;
  updatePoll: (pollId: string, updates: Partial<StreamPoll>) => void;
  votePoll: (pollId: string, optionId: string) => void;
  clearPolls: () => void;

  // AI Catch-Me-Up
  aiSummary: AISummary | null;
  setAISummary: (summary: AISummary | null) => void;

  // Hype
  hypeLevel: number;
  boostHype: (amount: number) => void;

  // Live Streak
  streaks: Record<string, { hostId: string; lastWatched: string; count: number }>;
  updateStreak: (hostId: string) => void;
  getStreak: (hostId: string) => number;

  // Reset for new stream
  resetStream: () => void;
}

export const useStreamStore = create<StreamStoreState>()(
  persist(
    (set, get) => ({
      activeAngleId: null,
      setActiveAngleId: (id) => set({ activeAngleId: id }),

      polls: [],
      addPoll: (poll) => set((s) => ({ polls: [...s.polls, poll] })),
      updatePoll: (pollId, updates) =>
        set((s) => ({
          polls: s.polls.map((p) => (p.id === pollId ? { ...p, ...updates } : p)),
        })),
      votePoll: (pollId, optionId) =>
        set((s) => ({
          polls: s.polls.map((p) => {
            if (p.id !== pollId || p.votedOptionId) return p;
            return {
              ...p,
              votedOptionId: optionId,
              options: p.options.map((o) =>
                o.id === optionId ? { ...o, votes: o.votes + 1 } : o
              ),
            };
          }),
        })),
      clearPolls: () => set({ polls: [] }),

      aiSummary: null,
      setAISummary: (summary) => set({ aiSummary: summary }),

      hypeLevel: 0,
      boostHype: (amount) => set((s) => ({ hypeLevel: Math.min(s.hypeLevel + amount, 100) })),

      streaks: {},
      updateStreak: (hostId) =>
        set((s) => {
          const now = new Date();
          const today = now.toISOString().split('T')[0];
          const existing = s.streaks[hostId];

          if (existing) {
            const lastDate = new Date(existing.lastWatched);
            const lastDay = lastDate.toISOString().split('T')[0];
            if (lastDay === today) return s; // Already counted today

            const diffMs = now.getTime() - lastDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            const newCount = diffDays <= 2 ? existing.count + 1 : 1;

            return {
              streaks: {
                ...s.streaks,
                [hostId]: { hostId, lastWatched: today, count: newCount },
              },
            };
          }

          return {
            streaks: {
              ...s.streaks,
              [hostId]: { hostId, lastWatched: today, count: 1 },
            },
          };
        }),
      getStreak: (hostId) => get().streaks[hostId]?.count || 0,

      resetStream: () =>
        set({
          activeAngleId: null,
          polls: [],
          aiSummary: null,
          hypeLevel: 0,
        }),
    }),
    {
      name: 'feedin-stream-store',
      partialize: (state) => ({
        streaks: state.streaks,
      }),
    }
  )
);
