import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { History, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ViewHistoryItem {
  post_id: string;
  content: string | null;
  media_url: string | null;
  author_name: string | null;
  author_username: string | null;
  author_avatar: string | null;
  viewed_at: string;
}

export const ViewHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<ViewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase.rpc('get_view_history', { p_limit: 50 });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error loading view history:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      const { error } = await supabase
        .from('post_view_history')
        .delete()
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      setHistory([]);
      toast.success('View history cleared');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Failed to clear history');
    }
  };

  const handlePostClick = (postId: string) => {
    navigate(`/post/${postId}`);
  };

  const truncateText = (text: string | null, maxLength: number = 80) => {
    if (!text) return 'No caption';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  const displayHistory = expanded ? history : history.slice(0, 5);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">View History</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            Last 48h
          </span>
        </div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No viewed posts in the last 48 hours</p>
        </div>
      ) : (
        <>
          <ScrollArea className={expanded ? 'h-[400px]' : 'max-h-[300px]'}>
            <div className="divide-y divide-border">
              {displayHistory.map((item) => (
                <button
                  key={item.post_id}
                  onClick={() => handlePostClick(item.post_id)}
                  className="w-full p-3 hover:bg-muted/50 transition-colors text-left flex items-start gap-3"
                >
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={item.author_avatar || ''} />
                    <AvatarFallback>
                      {item.author_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.author_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{item.author_username || 'user'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                      {truncateText(item.content)}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDistanceToNow(new Date(item.viewed_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-3" />
                </button>
              ))}
            </div>
          </ScrollArea>
          
          {/* Show More/Less */}
          {history.length > 5 && (
            <div className="p-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show Less' : `Show All (${history.length})`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ViewHistory;
