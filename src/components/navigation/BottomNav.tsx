import { Home, MessageCircle, User, Sparkles, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BottomNavProps {
  currentPage?: 'feed' | 'ai' | 'default';
  hidden?: boolean;
}

export const BottomNav = ({ currentPage = 'default', hidden = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'feed', label: 'Feeds', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
    { id: 'ai', label: 'FeedAI', icon: Sparkles, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}` },
  ];

  const isActive = (path: string) => location.pathname === path;

  // Hide navigation completely when hidden prop is true
  if (hidden) {
    return null;
  }

  return (
    <TooltipProvider>
      <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-card/70 backdrop-blur-lg border-t border-border/50 transition-all">
        <div className="container mx-auto px-2">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => navigate(item.path)}
                      variant="ghost"
                      className={`flex items-center justify-center h-auto p-2 ${
                        isActive(item.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
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
