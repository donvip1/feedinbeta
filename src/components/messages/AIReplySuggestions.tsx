import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

interface AIReplySuggestionsProps {
  conversationId: string;
  lastMessages: Array<{
    content: string;
    sender_id: string;
  }>;
  currentUserId: string;
  onSelectSuggestion: (suggestion: string) => void;
  onClose?: () => void;
}

const CREDIT_COST = 1;

export const AIReplySuggestions = ({
  conversationId,
  lastMessages,
  currentUserId,
  onSelectSuggestion,
  onClose,
}: AIReplySuggestionsProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();
  
  const { 
    balance, 
    hasEnoughCredits, 
    checkAndDeductCredits,
    isLoading: creditsLoading 
  } = useAIToolCredits({
    toolName: 'AI Smart Replies',
    creditCost: CREDIT_COST,
  });

  const generateSuggestions = async () => {
    setIsLoading(true);
    setSuggestions([]);

    try {
      // Try to deduct credits — the server will check balance accurately
      const canProceed = await checkAndDeductCredits();
      if (!canProceed) {
        setIsLoading(false);
        return;
      }

      // Build context from last messages
      const context = lastMessages
        .slice(-5)
        .map(msg => `${msg.sender_id === currentUserId ? 'Me' : 'Them'}: ${msg.content}`)
        .join('\n');

      // Call AI endpoint
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant that generates short, natural reply suggestions for chat conversations. Generate exactly 3 different reply options. Keep each reply under 50 characters. Make them casual and conversational. Return ONLY a JSON array of strings, nothing else.`
            },
            {
              role: 'user',
              content: `Based on this conversation, suggest 3 short replies I could send:\n\n${context}\n\nReturn only a JSON array like: ["reply1", "reply2", "reply3"]`
            }
          ],
        },
      });

      if (error) throw error;

      // Parse the response
      let replies: string[] = [];
      try {
        const content = data?.content || data?.message || data;
        if (typeof content === 'string') {
          // Try to extract JSON array from response
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            replies = JSON.parse(jsonMatch[0]);
          }
        } else if (Array.isArray(content)) {
          replies = content;
        }
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback suggestions
        replies = ['Thanks!', 'Sounds good 👍', 'Let me think about it'];
      }

      setSuggestions(replies.slice(0, 3));
      setIsVisible(true);
    } catch (error: any) {
      console.error('AI suggestions error:', error);
      toast({
        title: 'Failed to generate suggestions',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (suggestion: string) => {
    onSelectSuggestion(suggestion);
    setIsVisible(false);
    setSuggestions([]);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Suggestions Display */}
      <AnimatePresence>
        {isVisible && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-wrap gap-2 px-2 py-2 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-700"
          >
            <div className="flex items-center gap-1 text-xs text-purple-400 w-full mb-1">
              <Sparkles className="w-3 h-3" />
              <span>AI Suggestions</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-auto"
                onClick={() => {
                  setIsVisible(false);
                  onClose?.();
                }}
              >
                ×
              </Button>
            </div>
            {suggestions.map((suggestion, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm",
                  "bg-gradient-to-r from-purple-600/20 to-blue-600/20",
                  "border border-purple-500/30",
                  "text-purple-200 hover:text-white",
                  "hover:from-purple-600/40 hover:to-blue-600/40",
                  "transition-all duration-200 hover:scale-105"
                )}
              >
                {suggestion}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={generateSuggestions}
        disabled={isLoading || creditsLoading || lastMessages.length === 0}
        className={cn(
          "flex items-center gap-2 text-xs",
          "bg-gradient-to-r from-purple-500/10 to-blue-500/10",
          "border border-purple-500/20 rounded-full",
          "hover:from-purple-500/20 hover:to-blue-500/20",
          "text-purple-300 hover:text-purple-200"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3" />
            <span>AI Suggestions</span>
            <span className="text-[10px] opacity-60">({CREDIT_COST} credit)</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default AIReplySuggestions;
