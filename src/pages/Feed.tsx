import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/navigation/BottomNav';
import { FloatingActionButton } from '@/components/navigation/FloatingActionButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Search, TrendingUp, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Feed = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'following' | 'forYou'>('forYou');
  const feedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    localStorage.setItem('currentUserId', user.id);
  }, [user, authLoading, navigate]);

  const handleCreatePost = () => {
    toast({
      title: 'Post System Removed',
      description: 'The post creation system has been completely removed.',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 py-2 max-w-2xl mx-auto">
          <NotificationBell />
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('following')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'following'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('forYou')}
              className={`text-sm font-semibold transition-all ${
                activeTab === 'forYou'
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              For You
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/trending')}
            >
              <TrendingUp className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toast({ title: 'Search removed' })}
            >
              <Search className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/live')}
              className="relative"
            >
              <Radio className="w-5 h-5 text-red-500" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={feedContainerRef}
        className="max-w-2xl mx-auto"
      >
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground text-center px-4">
            Post system has been completely removed
          </p>
        </div>
      </div>

      <FloatingActionButton onClick={handleCreatePost} />
      <BottomNav />
    </div>
  );
};

export default Feed;
