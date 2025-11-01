import { Home, MessageCircle, Plus, Users, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  onQuickActionClick: () => void;
}

export const BottomNav = ({ onQuickActionClick }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'friends', label: 'Friends', icon: Users, path: '/friends' },
    { id: 'feedai', label: 'FeedAI', icon: Sparkles, path: '/feedai' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-around py-2 relative">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex flex-col items-center space-y-1 h-auto py-2 px-6 ${
                  isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
          
          {/* Central + Button */}
          <button
            onClick={onQuickActionClick}
            className="relative -mt-8 w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-glow hover:scale-110 transition-transform"
          >
            <Plus className="w-8 h-8 text-white" />
          </button>

          {navItems.slice(2, 4).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                onClick={() => navigate(item.path)}
                variant="ghost"
                className={`flex flex-col items-center space-y-1 h-auto py-2 px-6 ${
                  isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
