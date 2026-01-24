import React from 'react';
import { MessageCircle, Circle, Tv, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

interface MessagingTabsProps {
  activeTab: 'chats' | 'stories' | 'live';
  onTabChange: (tab: 'chats' | 'stories' | 'live') => void;
  unreadCount?: number;
  user: {
    name?: string;
    avatar?: string;
  } | null;
  secretMode?: boolean;
  onSecretModeToggle?: () => void;
}

const tabs = [
  { id: 'chats' as const, icon: MessageCircle, label: 'Chats' },
  { id: 'stories' as const, icon: Circle, label: 'Stories' },
  { id: 'live' as const, icon: Tv, label: 'Live' },
];

export const MessagingTabs = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  user,
  secretMode = false,
  onSecretModeToggle,
}: MessagingTabsProps) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800">
      {/* User Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border border-slate-600">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-cyan-500 text-white">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-bold text-white text-sm">{user?.name || 'User'}</h3>
            {secretMode && (
              <span className="text-xs text-red-400">Secret Mode Active</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onSecretModeToggle}
            className={cn(
              "rounded-lg transition-colors",
              secretMode 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            )}
            title={secretMode ? 'Disable Secret Mode' : 'Enable Secret Mode'}
          >
            <Shield className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-slate-950">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 py-3 flex flex-col items-center gap-1 text-xs font-bold transition-colors relative",
              activeTab === tab.id
                ? 'text-purple-400 bg-slate-900'
                : 'text-slate-500 hover:bg-slate-900 hover:text-slate-400'
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span>{tab.label}</span>
            
            {/* Unread Badge for Chats */}
            {tab.id === 'chats' && unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute top-1 right-1/4 h-5 min-w-[20px] flex items-center justify-center text-[10px] px-1"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
            
            {/* Active Indicator */}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MessagingTabs;
