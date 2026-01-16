import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Share2, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

interface ResponseActionsProps {
  content: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onFeedback?: (positive: boolean) => void;
  onShare?: () => void;
  onSave?: () => void;
}

export const ResponseActions = ({
  content,
  onCopy,
  onRegenerate,
  onFeedback,
  onShare,
  onSave,
}: ResponseActionsProps) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [saved, setSaved] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleFeedback = (positive: boolean) => {
    setFeedback(positive ? 'positive' : 'negative');
    onFeedback?.(positive);
    toast.success(positive ? 'Thanks for the feedback!' : 'We\'ll improve!');
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave?.();
    toast.success(saved ? 'Removed from saved' : 'Saved for later');
  };

  const actions = [
    {
      icon: copied ? Check : Copy,
      label: copied ? 'Copied!' : 'Copy',
      onClick: handleCopy,
      active: copied,
    },
    {
      icon: RefreshCw,
      label: 'Regenerate',
      onClick: onRegenerate,
      hidden: !onRegenerate,
    },
    {
      icon: ThumbsUp,
      label: 'Good response',
      onClick: () => handleFeedback(true),
      active: feedback === 'positive',
    },
    {
      icon: ThumbsDown,
      label: 'Bad response',
      onClick: () => handleFeedback(false),
      active: feedback === 'negative',
    },
    {
      icon: Share2,
      label: 'Share',
      onClick: onShare,
      hidden: !onShare,
    },
    {
      icon: Bookmark,
      label: saved ? 'Saved' : 'Save',
      onClick: handleSave,
      active: saved,
      hidden: !onSave,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1 mt-2"
    >
      <TooltipProvider delayDuration={300}>
        {actions
          .filter((action) => !action.hidden)
          .map((action, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={action.onClick}
                  className={`h-7 w-7 p-0 rounded-full transition-all ${
                    action.active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <action.icon className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {action.label}
              </TooltipContent>
            </Tooltip>
          ))}
      </TooltipProvider>
    </motion.div>
  );
};

export default ResponseActions;
