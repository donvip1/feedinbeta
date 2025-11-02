import { Home, MessageCircle, Plus, User, Sparkles, UsersRound } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  onQuickActionClick?: () => void;
  currentPage?: 'feed' | 'ai' | 'default';
}

export const BottomNav = ({ onQuickActionClick = () => {}, currentPage = 'default' }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'ai', label: 'FeedAI', icon: Sparkles, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}` },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
      <div className="container mx-auto px-2">
        <div className="flex items-center justify-around py-1 relative">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex flex-col items-center space-y-0.5 h-auto py-1.5 px-3 ${
                  isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
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
                  isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
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
