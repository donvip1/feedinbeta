import { Home, Mail, User, Zap, Wallet, BookOpen } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback } from 'react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface BottomNavProps {
  currentPage?: 'feed' | 'ai' | 'default';
  hidden?: boolean;
}

export const BottomNav = ({ currentPage = 'default', hidden = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { haptic } = useNativeFeatures();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);

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
    { id: 'chats', label: 'Chats', icon: Mail, path: '/messages' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
    { id: 'learn', label: 'Learn Tech', icon: BookOpen, path: '/learn-tech' },
    { id: 'ai', label: 'FeedAI', icon: Zap, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}`, isProfile: true },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = useCallback((path: string, itemId: string) => {
    // Trigger haptic feedback
    haptic('light');
    
    // Visual feedback
    setPressedId(itemId);
    setTimeout(() => setPressedId(null), 150);
    
    // Navigate
    navigate(path);
  }, [haptic, navigate]);

  // Hide navigation completely when hidden prop is true
  if (hidden) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[70] bg-background/95 backdrop-blur-lg border-t border-border/50 native-bottom-nav"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        <div className="max-w-screen-xl mx-auto px-2">
          <div className="flex items-center justify-between py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              const isPressed = pressedId === item.id;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleNavClick(item.path, item.id)}
                      variant="ghost"
                      size="icon"
                      className={`h-12 w-12 hover:bg-transparent transition-all duration-150 touch-feedback ${
                        active ? 'text-primary' : 'text-foreground/80 hover:text-foreground'
                      }`}
                      style={{
                        transform: isPressed ? 'scale(0.9)' : 'scale(1)',
                        transition: 'transform 0.1s ease-out',
                      }}
                    >
                      {item.isProfile && avatarUrl ? (
                        <div className={`rounded-full transition-all duration-150 ${active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
                          <Avatar className="w-7 h-7">
                            <AvatarImage src={avatarUrl} />
                            <AvatarFallback><Icon className="w-4 h-4" /></AvatarFallback>
                          </Avatar>
                        </div>
                      ) : (
                        <Icon 
                          size={24}
                          strokeWidth={2.5}
                          className={`transition-transform duration-150 ${active ? 'scale-110' : ''}`}
                        />
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
