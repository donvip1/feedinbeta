import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, MessageSquare, FileText, Type, Flag } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface TwitterSpaceSettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  spaceId: string;
}

export const TwitterSpaceSettingsMenu = ({
  isOpen,
  onClose,
  isHost,
  spaceId,
}: TwitterSpaceSettingsMenuProps) => {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  const options = [
    {
      label: 'Adjust settings',
      icon: <Settings className="w-5 h-5 text-zinc-400" />,
      onClick: () => {
        toast.info('Audio settings coming soon');
        onClose();
      },
    },
    {
      label: 'Share feedback',
      icon: <MessageSquare className="w-5 h-5 text-zinc-400" />,
      onClick: () => {
        toast.info('Thank you for your feedback!');
        onClose();
      },
    },
    {
      label: 'View rules',
      icon: <FileText className="w-5 h-5 text-zinc-400" />,
      onClick: () => {
        toast.info('Be respectful, no spam, keep it civil.');
        onClose();
      },
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

              {/* Captions toggle */}
              <div className="flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors">
                <span className="text-white font-medium">View captions</span>
                <Switch
                  checked={captionsEnabled}
                  onCheckedChange={(checked) => {
                    setCaptionsEnabled(checked);
                    toast.info(checked ? 'Captions enabled' : 'Captions disabled');
                  }}
                />
              </div>

              {/* Report option */}
              <button
                onClick={() => {
                  toast.info('Space reported. We will review it.');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <span className="text-red-500 font-medium">Report this Space</span>
                <Flag className="w-5 h-5 text-red-500" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
