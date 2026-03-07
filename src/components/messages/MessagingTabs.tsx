import React from 'react';
import { cn } from '@/lib/utils';

interface MessagingTabsProps {
  activeTab: 'chats' | 'groups' | 'live';
  onTabChange: (tab: 'chats' | 'groups' | 'live') => void;
  unreadCount?: number;
  groupUnreadCount?: number;
  secretMode?: boolean;
}

const tabs = [
  { id: 'chats' as const, label: 'All' },
  { id: 'groups' as const, label: 'Groups' },
  { id: 'live' as const, label: 'Live' },
];

export const MessagingTabs = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  groupUnreadCount = 0,
  secretMode = false,
}: MessagingTabsProps) => {
  return (
    <div className="flex items-center gap-6 px-4 overflow-x-auto no-scrollbar pt-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "text-sm font-black transition-all pb-2 border-b-2 whitespace-nowrap relative",
            activeTab === tab.id 
              ? secretMode 
                ? "border-destructive text-destructive" 
                : "border-primary text-foreground"
              : "border-transparent",
            activeTab !== tab.id && (
              secretMode
                ? "text-muted-foreground/60 hover:text-muted-foreground"
                : "text-muted-foreground hover:text-foreground"
            )
          )}
        >
          {tab.label}
          
          {/* Unread Badge for Chats */}
          {tab.id === 'chats' && unreadCount > 0 && (
            <span className="h-4 min-w-[16px] flex items-center justify-center text-[10px] font-bold px-1 ml-1.5 bg-primary text-primary-foreground rounded-full inline-flex">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          
          {/* Unread Badge for Groups */}
          {tab.id === 'groups' && groupUnreadCount > 0 && (
            <span className="h-4 min-w-[16px] flex items-center justify-center text-[10px] font-bold px-1 ml-1.5 bg-primary text-primary-foreground rounded-full inline-flex">
              {groupUnreadCount > 99 ? '99+' : groupUnreadCount}
            </span>
          )}
          
          {/* Live indicator dot */}
          {tab.id === 'live' && (
            <span className="ml-1 w-1.5 h-1.5 bg-destructive rounded-full inline-block animate-pulse mb-1" />
          )}
        </button>
      ))}
    </div>
  );
};

export default MessagingTabs;
