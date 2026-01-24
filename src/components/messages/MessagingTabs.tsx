import React from 'react';
import { MessageCircle, Circle, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface MessagingTabsProps {
  activeTab: 'chats' | 'stories' | 'live';
  onTabChange: (tab: 'chats' | 'stories' | 'live') => void;
  unreadCount?: number;
  secretMode?: boolean;
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
  secretMode = false,
}: MessagingTabsProps) => {
  return (
    <div className={cn(
      "flex rounded-lg overflow-hidden transition-colors",
      secretMode ? "bg-slate-800" : "bg-muted"
    )}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all relative",
            activeTab === tab.id
              ? secretMode 
                ? 'bg-slate-700 text-white' 
                : 'bg-background text-foreground shadow-sm'
              : secretMode
                ? 'text-slate-400 hover:text-slate-300'
                : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <tab.icon className="w-4 h-4" />
          <span>{tab.label}</span>
          
          {/* Unread Badge for Chats */}
          {tab.id === 'chats' && unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="h-4 min-w-[16px] flex items-center justify-center text-[10px] px-1 ml-1"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          
          {/* Active Indicator */}
          {activeTab === tab.id && (
            <motion.div
              layoutId="messaging-tab-indicator"
              className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5",
                secretMode 
                  ? "bg-gradient-to-r from-red-500 to-orange-500" 
                  : "bg-primary"
              )}
              initial={false}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
};

export default MessagingTabs;
