import { Home, MessageCircle, Plus, User, Sparkles, Wallet } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BottomNavProps {
  onQuickActionClick?: () => void;
  currentPage?: 'feed' | 'ai' | 'default';
  minimized?: boolean;
  hidden?: boolean;
}

export const BottomNav = ({ onQuickActionClick = () => {}, currentPage = 'default', minimized = false, hidden = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/feed' },
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

  // When minimized, only show the + button
  if (minimized) {
    return (
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70]">
        <button
          onClick={onQuickActionClick}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-glow hover:scale-110 transition-transform"
        >
          <Plus className="w-7 h-7 text-white" />
        </button>
      </nav>
    );
  }

  return (
    <TooltipProvider>
      <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-card/70 backdrop-blur-lg border-t border-border/50 transition-all">
        <div className="container mx-auto px-2">
          <div className="flex items-center justify-around py-2 relative">
            {navItems.slice(0, 2).map((item) => {
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
            
            {/* Central + Button */}
            <button
              onClick={onQuickActionClick}
              className="relative -mt-5 w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-glow hover:scale-110 transition-transform"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>

            {navItems.slice(2).map((item) => {
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
