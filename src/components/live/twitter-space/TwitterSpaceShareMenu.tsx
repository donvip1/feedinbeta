import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, MessageCircle, Share2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { shareUrls } from '@/lib/url-utils';

interface TwitterSpaceShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  shareLink: string;
  spaceTitle: string;
  coverImageUrl?: string;
}

export const TwitterSpaceShareMenu = ({
  isOpen,
  onClose,
  spaceId,
  shareLink,
  spaceTitle,
  coverImageUrl,
}: TwitterSpaceShareMenuProps) => {
  const shareUrl = shareUrls.liveSpace(shareLink || spaceId);

  const shareText = `🎙️ Join me in this live space: "${spaceTitle || 'Live Space'}" on FeedIn!\n\n${shareUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
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
          title: `🎙️ ${spaceTitle || 'Live Space'} — FeedIn Live`,
          text: `Join me in this live space: "${spaceTitle}" on FeedIn!`,
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
        window.location.href = `/compose?content=${encodeURIComponent(`🎙️ Join me in this live space: "${spaceTitle}" on FeedIn!\n\n${shareUrl}`)}`;
      },
    },
    {
      label: 'Invite via Chat',
      icon: <MessageCircle className="w-5 h-5 text-zinc-400" />,
      onClick: () => {
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
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-4" />

            {/* Link Preview Card */}
            <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-800/50">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt={spaceTitle}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-20 bg-gradient-to-r from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-purple-400" />
                </div>
              )}
              <div className="px-3 py-2">
                <p className="text-white text-sm font-semibold truncate">{spaceTitle || 'Live Space'}</p>
                <p className="text-zinc-500 text-xs truncate">feedinn.com</p>
              </div>
            </div>

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
