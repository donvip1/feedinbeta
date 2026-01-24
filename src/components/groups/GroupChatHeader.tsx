import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, 
  MoreVertical, 
  Users, 
  Settings, 
  Bell, 
  BellOff, 
  Search,
  Link2,
  LogOut,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupChatHeaderProps {
  group: {
    id: string;
    name: string;
    avatar_url?: string | null;
    description?: string | null;
    member_count?: number;
    is_private?: boolean;
  };
  isAdmin?: boolean;
  isMuted?: boolean;
  onBack: () => void;
  onShowMembers: () => void;
  onShowSettings?: () => void;
  onToggleMute?: () => void;
  onShowSearch?: () => void;
  onShareInvite?: () => void;
  onLeaveGroup?: () => void;
  className?: string;
}

export const GroupChatHeader = ({
  group,
  isAdmin = false,
  isMuted = false,
  onBack,
  onShowMembers,
  onShowSettings,
  onToggleMute,
  onShowSearch,
  onShareInvite,
  onLeaveGroup,
  className,
}: GroupChatHeaderProps) => {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-background/95 backdrop-blur-sm border-b border-border/50",
      className
    )}>
      {/* Back Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full"
        onClick={onBack}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Group Info */}
      <div
        className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onShowMembers}
      >
        <Avatar className="h-10 w-10 ring-2 ring-primary/10">
          <AvatarImage src={group.avatar_url || ''} />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-sm font-semibold">
            {group.name?.[0]?.toUpperCase() || 'G'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground truncate">{group.name}</h2>
            {group.is_private && (
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {group.member_count || 0} members
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={onShowSearch}
        >
          <Search className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl">
            <DropdownMenuItem onClick={onShowMembers} className="gap-2">
              <Users className="w-4 h-4" />
              View members
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={onShareInvite} className="gap-2">
              <Link2 className="w-4 h-4" />
              Share invite link
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={onToggleMute} className="gap-2">
              {isMuted ? (
                <>
                  <Bell className="w-4 h-4" />
                  Unmute notifications
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4" />
                  Mute notifications
                </>
              )}
            </DropdownMenuItem>

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onShowSettings} className="gap-2">
                  <Settings className="w-4 h-4" />
                  Group settings
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onLeaveGroup} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Leave group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default GroupChatHeader;
