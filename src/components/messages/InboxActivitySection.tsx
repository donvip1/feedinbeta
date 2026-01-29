import React from 'react';
import { UserPlus, Heart, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityItemProps {
  icon: React.ElementType;
  color: string;
  title: string;
  desc: string;
  onClick?: () => void;
}

const ActivityItem = ({ icon: Icon, color, title, desc, onClick }: ActivityItemProps) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer active:scale-[0.98] w-full rounded-xl"
  >
    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shadow-sm", color)}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1 text-left">
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  </button>
);

interface InboxActivitySectionProps {
  onFollowersClick?: () => void;
  onActivityClick?: () => void;
  onSystemClick?: () => void;
}

export const InboxActivitySection = ({ 
  onFollowersClick, 
  onActivityClick, 
  onSystemClick 
}: InboxActivitySectionProps) => {
  return (
    <div className="px-2 py-1">
      <ActivityItem 
        icon={UserPlus} 
        color="bg-gradient-to-br from-purple-500 to-violet-600" 
        title="Follow requests" 
        desc="People want to follow you"
        onClick={onFollowersClick}
      />
      <ActivityItem 
        icon={Heart} 
        color="bg-gradient-to-br from-pink-500 to-rose-500" 
        title="Activity" 
        desc="Likes, comments & mentions"
        onClick={onActivityClick}
      />
      <ActivityItem 
        icon={Bell} 
        color="bg-gradient-to-br from-muted to-secondary border border-border" 
        title="System notifications" 
        desc="Updates & announcements"
        onClick={onSystemClick}
      />
      
      {/* Divider */}
      <div className="h-px bg-border/50 my-2 mx-3" />
      
      {/* Section Label */}
      <div className="px-4 py-2 flex justify-between items-center">
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Direct Messages
        </h4>
        <button className="text-[10px] text-primary font-bold hover:underline">
          Mark all read
        </button>
      </div>
    </div>
  );
};

export default InboxActivitySection;
