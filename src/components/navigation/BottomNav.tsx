import React from 'react';
import { Link } from 'react-router-dom';
import { Home, MessageCircle, Plus, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BottomNavProps {
  onQuickActionClick?: () => void;
  currentPage?: 'feed' | 'ai' | 'default';
  minimized?: boolean;
}

export const BottomNav = ({ onQuickActionClick = () => {}, currentPage = 'default', minimized = false }: BottomNavProps) => {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const navItems = [
    { id: 'feed', label: 'Feed', icon: Home, path: '/feed' },
    { id: 'chats', label: 'Chats', icon: MessageCircle, path: '/messages' },
    { id: 'ai', label: 'FeedAI', icon: Sparkles, path: '/ai-copilot' },
    { id: 'profile', label: 'Profile', icon: User, path: `/profile/${localStorage.getItem('currentUserId') || ''}` },
  ];

  const isActive = (path: string) => currentPath === path;

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
    <nav className="fixed bottom-0 left-0 right-0 z-[70] bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 transition-all">
      <div className="container mx-auto px-2">
        <div className="flex items-center justify-around py-1 relative">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} to={item.path}>
                <Button
                  variant="ghost"
                  className={`flex flex-col items-center space-y-0.5 h-auto py-1.5 px-3 ${
                    isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Button>
              </Link>
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
              <Link key={item.id} to={item.path}>
                <Button
                  variant="ghost"
                  className={`flex flex-col items-center space-y-0.5 h-auto py-1.5 px-3 ${
                    isActive(item.path) ? 'text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
