import React from 'react';
import { MessageSquare, Tv, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessagingTabsProps {
  activeTab: 'chats' | 'groups' | 'live';
  onTabChange: (tab: 'chats' | 'groups' | 'live') => void;
  unreadCount?: number;
  groupUnreadCount?: number;
  secretMode?: boolean;
}

const tabs = [
  { id: 'chats' as const, icon: MessageSquare, label: 'Chats' },
  { id: 'groups' as const, icon: Users, label: 'Groups' },
  { id: 'live' as const, icon: Tv, label: 'Live' },
];

export const MessagingTabs = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  groupUnreadCount = 0,
  secretMode = false,
}: MessagingTabsProps) => {
  return (
    <div className="flex items-center justify-around px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 pb-2 px-3 text-sm font-medium transition-all relative",
            activeTab === tab.id 
              ? secretMode 
                ? "text-red-400" 
                : "text-primary"
              : secretMode
                ? "text-slate-400 hover:text-slate-300"
                : "text-muted-foreground hover:text-foreground"
          )}
        >
          <tab.icon className="w-4 h-4" />
          <span>{tab.label}</span>
          
          {/* Unread Badge for Chats */}
          {tab.id === 'chats' && unreadCount > 0 && (
            <span className="h-4 min-w-[16px] flex items-center justify-center text-[10px] font-bold px-1 ml-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          
          {/* Unread Badge for Groups */}
          {tab.id === 'groups' && groupUnreadCount > 0 && (
            <span className="h-4 min-w-[16px] flex items-center justify-center text-[10px] font-bold px-1 ml-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full">
              {groupUnreadCount > 99 ? '99+' : groupUnreadCount}
            </span>
          )}
          
          {/* Active Indicator */}
          {activeTab === tab.id && (
            <div 
              className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 rounded-full animate-in fade-in slide-in-from-bottom-1",
                secretMode 
                  ? "bg-gradient-to-r from-red-500 to-orange-500" 
                  : "bg-primary"
              )}
            />
          )}
        </button>
      ))}
    </div>
  );
};

export default MessagingTabs;
