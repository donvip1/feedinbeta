import React from 'react';
import { motion } from 'framer-motion';
import { Users, Heart, Bell, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'followers' | 'activity' | 'system';
  title: string;
  subtitle: string;
  icon_url?: string;
  count?: number;
  timestamp?: string;
}

interface InboxActivitySectionProps {
  activities: ActivityItem[];
  onActivityClick?: (activity: ActivityItem) => void;
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'followers':
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-pink">
          <Users className="w-6 h-6 text-primary-foreground" />
        </div>
      );
    case 'activity':
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-pink">
          <Heart className="w-6 h-6 text-white fill-white" />
        </div>
      );
    case 'system':
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted to-secondary flex items-center justify-center border border-border">
          <Bell className="w-6 h-6 text-muted-foreground" />
        </div>
      );
    default:
      return null;
  }
};

const ActivityRow = ({ 
  activity, 
  onClick,
  index 
}: { 
  activity: ActivityItem; 
  onClick?: () => void;
  index: number;
}) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 rounded-xl transition-colors group"
    >
      {getActivityIcon(activity.type)}
      
      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-foreground truncate">{activity.title}</p>
        <p className="text-sm text-muted-foreground truncate">{activity.subtitle}</p>
      </div>
      
      <div className="flex items-center gap-2">
        {activity.timestamp && (
          <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
        )}
        {activity.count && activity.count > 0 && (
          <Badge 
            className={cn(
              "h-5 min-w-[20px] flex items-center justify-center text-[10px] font-bold px-1.5",
              activity.type === 'followers' ? "bg-primary" : "bg-gradient-to-r from-pink-500 to-rose-500"
            )}
          >
            {activity.count > 99 ? '99+' : activity.count}
          </Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.button>
  );
};

export const InboxActivitySection = ({ 
  activities, 
  onActivityClick 
}: InboxActivitySectionProps) => {
  if (activities.length === 0) return null;
  
  return (
    <div className="px-2 py-1">
      {activities.map((activity, index) => (
        <ActivityRow
          key={activity.id}
          activity={activity}
          onClick={() => onActivityClick?.(activity)}
          index={index}
        />
      ))}
      
      {/* Divider */}
      <div className="h-px bg-border/50 my-2 mx-3" />
    </div>
  );
};

export default InboxActivitySection;
