import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { shareUrls } from '@/lib/url-utils';

interface TwitterSpaceShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  shareLink: string;
  spaceTitle: string;
}

export const TwitterSpaceShareMenu = ({
  isOpen,
  onClose,
  spaceId,
  shareLink,
  spaceTitle,
}: TwitterSpaceShareMenuProps) => {
  const shareUrl = shareUrls.liveSpace(shareLink || spaceId);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
      onClose();
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: spaceTitle,
          text: `Join me in this live space: ${spaceTitle}`,
          url: shareUrl,
        });
        onClose();
      } catch (error) {
        // User cancelled or error
      }
    } else {
      handleCopyLink();
    }
  };

  const options = [
    {
      label: 'Share via post',
      icon: (
        <div className="flex items-center gap-0.5">
          <span className="text-lg font-bold text-purple-400">+</span>
          <Share2 className="w-4 h-4 text-zinc-400" />
        </div>
      ),
      onClick: () => {
        // Navigate to compose with space link
        window.location.href = `/compose?content=${encodeURIComponent(`Join me in this live space! ${shareUrl}`)}`;
      },
    },
    {
      label: 'Invite via Chat',
      icon: <MessageCircle className="w-5 h-5 text-zinc-400" />,
      onClick: () => {
        // Could open invite modal
        toast.info('Coming soon');
        onClose();
      },
    },
    {
      label: 'Copy Link',
      icon: <Link className="w-5 h-5 text-zinc-400" />,
      onClick: handleCopyLink,
    },
    {
      label: 'Share via...',
      icon: <Share2 className="w-5 h-5 text-zinc-400" />,
      onClick: handleNativeShare,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 rounded-t-3xl p-6 pb-safe"
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-6" />

            <div className="space-y-1">
              {options.map((option) => (
                <button
                  key={option.label}
                  onClick={option.onClick}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <span className="text-white font-medium">{option.label}</span>
                  {option.icon}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
