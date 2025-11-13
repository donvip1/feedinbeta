import { Home, MessageCircle, Plus, User, Sparkles, UsersRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

interface BottomNavProps {
  onQuickActionClick?: () => void;
  currentPage?: 'feed' | 'ai' | 'default';
  minimized?: boolean;
}

export const BottomNav = ({ onQuickActionClick = () => {}, currentPage = 'default', minimized = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'ai', label: 'FeedAI', icon: Sparkles, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}` },
  ];

  const isActive = (path: string) => location.pathname === path;

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
    <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-card/95 backdrop-blur-lg border-t border-border transition-all">
      <div className="container mx-auto px-2">
        <div className="flex items-center justify-around py-1 relative">
          {/* Theme Toggle on far left */}
          <div className="absolute left-2">
            <ThemeToggle />
          </div>
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex flex-col items-center space-y-0.5 h-auto py-1.5 px-3 ${
                  isActive(item.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Button>
            );
          })}
          
          {/* Central + Button */}
          <button
            onClick={onQuickActionClick}
            className="relative -mt-6 w-11 h-11 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-glow hover:scale-110 transition-transform"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>

          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex flex-col items-center space-y-0.5 h-auto py-1.5 px-3 ${
                  isActive(item.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
