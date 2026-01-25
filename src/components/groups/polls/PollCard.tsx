import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, BarChart3, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';

interface PollOption {
  id: number;
  text: string;
}

interface Vote {
  user_id: string;
  option_index: number;
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  is_multiple_choice: boolean;
  is_anonymous: boolean;
  creator_id: string;
  created_at: string;
}

interface PollCardProps {
  poll: Poll;
  isOwn: boolean;
}

export const PollCard = ({ poll, isOwn }: PollCardProps) => {
  const navigate = useNavigate();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [myVotes, setMyVotes] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVoters, setShowVoters] = useState<number | null>(null);

  useEffect(() => {
    loadVotes();
    
    // Subscribe to vote changes
    const channel = supabase
      .channel(`poll-votes-${poll.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_poll_votes',
          filter: `poll_id=eq.${poll.id}`,
        },
        () => loadVotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poll.id]);

  const loadVotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('group_poll_votes')
      .select(`
        user_id,
        option_index,
        profiles:user_id (
          display_name,
          avatar_url
        )
      `)
      .eq('poll_id', poll.id);

    if (!error && data) {
      setVotes(data as unknown as Vote[]);
      if (user) {
        setMyVotes(data.filter(v => v.user_id === user.id).map(v => v.option_index));
      }
    }
  };

  const handleVote = async (optionIndex: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      const hasVoted = myVotes.includes(optionIndex);

      if (hasVoted) {
        // Remove vote
        await supabase
          .from('group_poll_votes')
          .delete()
          .eq('poll_id', poll.id)
          .eq('user_id', user.id)
          .eq('option_index', optionIndex);
      } else {
        // If not multiple choice, remove previous votes first
        if (!poll.is_multiple_choice && myVotes.length > 0) {
          await supabase
            .from('group_poll_votes')
            .delete()
            .eq('poll_id', poll.id)
            .eq('user_id', user.id);
        }

        // Add new vote
        await supabase
          .from('group_poll_votes')
          .insert({
            poll_id: poll.id,
            user_id: user.id,
            option_index: optionIndex,
          });
      }

      await loadVotes();
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalVoters = new Set(votes.map(v => v.user_id)).size;
  const getVotesForOption = (index: number) => votes.filter(v => v.option_index === index);
  const getPercentage = (index: number) => {
    if (totalVoters === 0) return 0;
    return Math.round((getVotesForOption(index).length / totalVoters) * 100);
  };

  return (
    <div className={cn(
      "rounded-2xl p-4 min-w-[260px] max-w-[300px]",
      isOwn ? "bg-primary/90 text-primary-foreground" : "bg-muted"
    )}>
      <div className="flex items-start gap-2 mb-3">
        <BarChart3 className="w-5 h-5 mt-0.5 shrink-0" />
        <p className="font-medium text-sm leading-snug">{poll.question}</p>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const percentage = getPercentage(index);
          const isSelected = myVotes.includes(index);
          const optionVotes = getVotesForOption(index);

          return (
            <div key={option.id} className="relative">
              <button
                onClick={() => handleVote(index)}
                disabled={loading}
                className={cn(
                  "w-full text-left p-2.5 rounded-xl relative overflow-hidden transition-all",
                  "border",
                  isOwn
                    ? isSelected
                      ? "border-white/50 bg-white/20"
                      : "border-white/20 hover:border-white/40"
                    : isSelected
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:border-primary/30"
                )}
              >
                {/* Progress bar background */}
                {myVotes.length > 0 && (
                  <div
                    className={cn(
                      "absolute inset-0 transition-all duration-500",
                      isOwn ? "bg-white/10" : "bg-primary/10"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                )}

                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0" />
                    )}
                    <span className="text-sm truncate">{option.text}</span>
                  </div>
                  {myVotes.length > 0 && (
                    <span className="text-xs font-medium shrink-0">{percentage}%</span>
                  )}
                </div>
              </button>

              {/* Voter avatars (non-anonymous) */}
              {!poll.is_anonymous && optionVotes.length > 0 && myVotes.length > 0 && (
                <button
                  onClick={() => setShowVoters(showVoters === index ? null : index)}
                  className="flex items-center gap-1 mt-1 ml-1"
                >
                  <div className="flex -space-x-1.5">
                    {optionVotes.slice(0, 3).map((vote, i) => (
                      <Avatar 
                        key={i} 
                        className="w-5 h-5 border border-background cursor-pointer hover:ring-2 hover:ring-primary/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${vote.user_id}`);
                        }}
                      >
                        <AvatarImage src={vote.profiles?.avatar_url || ''} />
                        <AvatarFallback className="text-[8px]">
                          {vote.profiles?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {optionVotes.length > 3 && (
                    <span className={cn(
                      "text-xs",
                      isOwn ? "text-white/70" : "text-muted-foreground"
                    )}>
                      +{optionVotes.length - 3}
                    </span>
                  )}
                </button>
              )}

              {/* Expanded voter list */}
              {showVoters === index && !poll.is_anonymous && (
                <div className={cn(
                  "mt-2 p-2 rounded-lg space-y-1.5",
                  isOwn ? "bg-white/10" : "bg-muted"
                )}>
                  {optionVotes.map((vote, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                      onClick={() => navigate(`/profile/${vote.user_id}`)}
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={vote.profiles?.avatar_url || ''} />
                        <AvatarFallback className="text-[10px]">
                          {vote.profiles?.display_name?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate">
                        {vote.profiles?.display_name || 'User'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={cn(
        "flex items-center gap-1.5 mt-3 pt-2 border-t text-xs",
        isOwn ? "border-white/20 text-white/70" : "border-border text-muted-foreground"
      )}>
        <Users className="w-3.5 h-3.5" />
        <span>{totalVoters} vote{totalVoters !== 1 ? 's' : ''}</span>
        {poll.is_multiple_choice && (
          <span className="ml-auto">• Multiple choice</span>
        )}
        {poll.is_anonymous && (
          <span className="ml-auto">• Anonymous</span>
        )}
      </div>
    </div>
  );
};
