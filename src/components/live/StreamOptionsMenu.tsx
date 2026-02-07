import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Share2,
  Flag,
  Copy,
  Ban,
  Bell,
  BellOff,
  Maximize2,
  Settings,
  Users,
  Lock,
  Unlock,
  PhoneOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { shareUrls } from '@/lib/url-utils';

interface StreamOptionsMenuProps {
  isHost: boolean;
  streamId: string;
  hostId: string;
  streamTitle: string;
  isChatLocked?: boolean;
  onToggleChatLock?: () => void;
  onEndStream?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
  className?: string;
}

export const StreamOptionsMenu = ({
  isHost,
  streamId,
  hostId,
  streamTitle,
  isChatLocked = false,
  onToggleChatLock,
  onEndStream,
  onReport,
  onBlock,
  className,
}: StreamOptionsMenuProps) => {
  const [isNotificationsOn, setIsNotificationsOn] = useState(true);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const handleShare = async () => {
    const shareUrl = shareUrls.liveStream(streamId);
    try {
      await navigator.share({
        title: streamTitle,
        text: `Watch this live stream!`,
        url: shareUrl,
      });
    } catch {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleCopyLink = () => {
    const shareUrl = shareUrls.liveStream(streamId);
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const handlePictureInPicture = async () => {
    try {
      const videoEl = document.querySelector('video');
      if (videoEl) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPiPActive(false);
        } else {
          await videoEl.requestPictureInPicture();
          setIsPiPActive(true);
        }
      }
    } catch (error) {
      toast.error("Picture-in-picture not supported");
    }
  };

  const handleToggleNotifications = () => {
    setIsNotificationsOn(!isNotificationsOn);
    toast.success(isNotificationsOn ? "Notifications off" : "Notifications on");
  };

  const handleReport = () => {
    if (onReport) {
      onReport();
    } else {
      toast.success("Report submitted");
    }
  };

  const handleBlock = () => {
    if (onBlock) {
      onBlock();
    } else {
      toast.success("Host blocked");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className={cn(
            "p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors",
            className
          )}
        >
          <MoreHorizontal className="w-5 h-5" />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56 bg-background/95 backdrop-blur-md border-border"
      >
        {/* Common Actions */}
        <DropdownMenuItem onClick={handleShare} className="cursor-pointer">
          <Share2 className="w-4 h-4 mr-2" />
          Share Stream
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePictureInPicture} className="cursor-pointer">
          <Maximize2 className="w-4 h-4 mr-2" />
          {isPiPActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {isHost ? (
          // Host Options
          <>
            <DropdownMenuItem onClick={onToggleChatLock} className="cursor-pointer">
              {isChatLocked ? (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock Chat
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Chat
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Users className="w-4 h-4 mr-2" />
              Manage Viewers
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Stream Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onEndStream} 
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              End Stream
            </DropdownMenuItem>
          </>
        ) : (
          // Viewer Options
          <>
            <DropdownMenuItem onClick={handleToggleNotifications} className="cursor-pointer">
              {isNotificationsOn ? (
                <>
                  <BellOff className="w-4 h-4 mr-2" />
                  Turn Off Notifications
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  Turn On Notifications
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleReport} className="cursor-pointer">
              <Flag className="w-4 h-4 mr-2" />
              Report Stream
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleBlock} 
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Ban className="w-4 h-4 mr-2" />
              Block Host
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StreamOptionsMenu;
