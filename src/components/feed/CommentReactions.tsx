import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  count: number;
  users: Array<{
    user_id: string;
    username?: string;
    avatar_url?: string;
  }>;
  hasReacted: boolean;
}

interface ReactionData {
  emoji: string;
  user_id: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface CommentReactionsProps {
  commentId: string;
  onReactionChange?: () => void;
}

export const CommentReactions = ({ commentId, onReactionChange }: CommentReactionsProps) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('comment_emoji_reactions')
        .select(`
          emoji,
          user_id,
          profiles!comment_emoji_reactions_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('comment_id', commentId);

      if (error) throw error;

      // Group reactions by emoji
      const grouped = (data || []).reduce((acc: Record<string, Reaction>, curr: any) => {
        if (!acc[curr.emoji]) {
          acc[curr.emoji] = {
            emoji: curr.emoji,
            count: 0,
            users: [],
            hasReacted: false
          };
        }
        
        acc[curr.emoji].count++;
        acc[curr.emoji].users.push({
          user_id: curr.user_id,
          username: curr.profiles?.username || undefined,
          avatar_url: curr.profiles?.avatar_url || undefined
        });
        
        if (user && curr.user_id === user.id) {
          acc[curr.emoji].hasReacted = true;
        }
        
        return acc;
      }, {});

      setReactions(Object.values(grouped).sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  }, [commentId, user]);

  useEffect(() => {
    loadReactions();

    // Subscribe to reaction changes
    const channel = supabase
      .channel(`comment-reactions-${commentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comment_emoji_reactions',
          filter: `comment_id=eq.${commentId}`
        },
        () => {
          loadReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentId, loadReactions]);

  const handleReactionToggle = async (emoji: string, hasReacted: boolean) => {
    if (!user || loading) return;

    setLoading(true);
    try {
      if (hasReacted) {
        // Remove reaction
        const { error } = await supabase
          .from('comment_emoji_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('comment_emoji_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            emoji: emoji
          });

        if (error) throw error;
      }

      onReactionChange?.();
    } catch (error) {
      console.error('Error toggling reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      <TooltipProvider>
        {reactions.map((reaction) => (
          <Tooltip key={reaction.emoji}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReactionToggle(reaction.emoji, reaction.hasReacted)}
                className={cn(
                  "h-7 px-2 py-1 rounded-full text-xs",
                  reaction.hasReacted
                    ? "bg-primary/20 border border-primary/50"
                    : "bg-muted hover:bg-accent"
                )}
                disabled={loading}
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span className="text-xs font-medium">{reaction.count}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-1">
                {reaction.users.slice(0, 5).map((reactUser, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Avatar className="h-5 w-5">
                      <img
                        src={reactUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reactUser.username}`}
                        alt={reactUser.username || 'User'}
                      />
                    </Avatar>
                    <span>{reactUser.username || 'Anonymous'}</span>
                  </div>
                ))}
                {reaction.count > 5 && (
                  <p className="text-xs text-muted-foreground">
                    and {reaction.count - 5} more
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
};