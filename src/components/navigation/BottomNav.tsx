import { Home, MessageCircle, User, Sparkles, Wallet, GraduationCap, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

interface BottomNavProps {
  currentPage?: 'feed' | 'ai' | 'default';
  hidden?: boolean;
}

export const BottomNav = ({ currentPage = 'default', hidden = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadAvatar();
    }
  }, [user]);

  const loadAvatar = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
    if (data) {
      setAvatarUrl(data.avatar_url);
    }
  };

  const navItems = [
    { id: 'feed', label: 'Feeds', icon: Home, path: '/feed' },
    { id: 'search', label: 'Search', icon: Search, path: '/search' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
    { id: 'ai', label: 'FeedAI', icon: Sparkles, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}`, isProfile: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Hide navigation completely when hidden prop is true
  if (hidden) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-background/95 backdrop-blur-lg border-t border-white/30 transition-all">
        <div className="container mx-auto px-2">
          <div className="flex items-center justify-around py-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => navigate(item.path)}
                      variant="ghost"
                      className={`flex flex-col items-center justify-center gap-1 h-auto p-2 hover:bg-transparent ${
                        active ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {item.isProfile && avatarUrl ? (
                        <div className={`rounded-full p-0.5 ${active ? 'ring-1 ring-white ring-offset-1 ring-offset-background' : 'border border-white'}`}>
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback><Icon className="w-6 h-6" /></AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <div className={`${active ? 'bg-primary/10' : ''}`}>
                          <Icon 
                            size={39}
                            strokeWidth={2}
                            stroke="currentColor"
                          />
                        </div>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
};
