import React from 'react';
import { format } from 'date-fns';
import { Clock, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ScheduledMessage {
  id: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message?: string | null;
  created_at: string;
}

interface ScheduledMessagesListProps {
  messages: ScheduledMessage[];
  onCancel: (id: string) => void;
  onRetry?: (id: string) => void;
}

export const ScheduledMessagesList = ({
  messages,
  onCancel,
  onRetry,
}: ScheduledMessagesListProps) => {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No scheduled messages</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(
              "p-3 rounded-xl border transition-colors",
              message.status === 'pending' && "bg-card border-border",
              message.status === 'sent' && "bg-primary/5 border-primary/20",
              message.status === 'failed' && "bg-destructive/5 border-destructive/20",
              message.status === 'cancelled' && "bg-muted border-border opacity-60"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className={cn(
                "p-2 rounded-full flex-shrink-0",
                message.status === 'pending' && "bg-primary/10 text-primary",
                message.status === 'sent' && "bg-primary/20 text-primary",
                message.status === 'failed' && "bg-destructive/10 text-destructive",
                message.status === 'cancelled' && "bg-muted text-muted-foreground"
              )}>
                {message.status === 'pending' && <Clock className="w-4 h-4" />}
                {message.status === 'sent' && <Check className="w-4 h-4" />}
                {message.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                {message.status === 'cancelled' && <X className="w-4 h-4" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{message.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    message.status === 'pending' && "bg-primary/10 text-primary",
                    message.status === 'sent' && "bg-primary/10 text-primary",
                    message.status === 'failed' && "bg-destructive/10 text-destructive",
                    message.status === 'cancelled' && "bg-muted text-muted-foreground"
                  )}>
                    {message.status === 'pending' ? 'Scheduled' : message.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.scheduled_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                {message.error_message && (
                  <p className="text-xs text-destructive mt-1">{message.error_message}</p>
                )}
              </div>

              {/* Actions */}
              {message.status === 'pending' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(message.id)}
                  className="flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {message.status === 'failed' && onRetry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRetry(message.id)}
                  className="flex-shrink-0"
                >
                  Retry
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
