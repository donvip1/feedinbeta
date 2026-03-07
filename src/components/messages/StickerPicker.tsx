import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: string[];
}

const BUILT_IN_PACKS: StickerPack[] = [
  {
    id: 'emotions',
    name: 'Emotions',
    icon: '😀',
    stickers: [
      '😀', '😂', '🥹', '😍', '🥰', '😘', '😜', '🤪',
      '😎', '🤩', '🥳', '😤', '😡', '🥺', '😭', '😱',
      '🤯', '🫠', '😶‍🌫️', '🤑', '🫡', '🤫', '🫣', '😈',
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '👋',
    stickers: [
      '👋', '🤝', '👍', '👎', '✌️', '🤞', '🫶', '👏',
      '🙌', '💪', '🫰', '🤌', '👊', '✊', '🤙', '🫵',
      '☝️', '👆', '👇', '👈', '👉', '🖐️', '🤚', '🫱',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: '🐱',
    stickers: [
      '🐱', '🐶', '🐻', '🐼', '🦊', '🐯', '🦁', '🐮',
      '🐷', '🐸', '🐵', '🐔', '🦄', '🐝', '🦋', '🐢',
      '🐬', '🦈', '🐙', '🦜', '🦩', '🐧', '🐨', '🦥',
    ],
  },
  {
    id: 'love',
    name: 'Love',
    icon: '❤️',
    stickers: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💕', '💞', '💓', '💗', '💖', '💝', '💘', '💌',
      '🫀', '💋', '💐', '🌹', '🌺', '🌸', '💒', '💍',
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🍕',
    stickers: [
      '🍕', '🍔', '🌮', '🍣', '🍜', '🍩', '🧁', '🎂',
      '🍦', '🍪', '🍫', '🍿', '☕', '🧋', '🍺', '🥤',
      '🍉', '🍇', '🍓', '🥑', '🌶️', '🥕', '🌽', '🍳',
    ],
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: '⚽',
    stickers: [
      '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎮', '🎯',
      '🎪', '🎨', '🎭', '🎬', '🎤', '🎧', '🎵', '🎶',
      '🎸', '🥁', '🏆', '🥇', '🎖️', '🏅', '🎗️', '🎟️',
    ],
  },
];

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: string) => void;
}

export const StickerPicker = ({ isOpen, onClose, onSelectSticker }: StickerPickerProps) => {
  const [activePack, setActivePack] = useState(BUILT_IN_PACKS[0].id);

  const currentPack = BUILT_IN_PACKS.find(p => p.id === activePack) || BUILT_IN_PACKS[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 280 }}
          exit={{ opacity: 0, y: 20, height: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card border-t border-border/50 overflow-hidden"
        >
          {/* Header with pack name and close */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {currentPack.name}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Sticker grid */}
          <ScrollArea className="h-[210px]">
            <div className="grid grid-cols-8 gap-0.5 p-2">
              {currentPack.stickers.map((sticker, i) => (
                <button
                  key={`${activePack}-${i}`}
                  onClick={() => {
                    onSelectSticker(sticker);
                    onClose();
                  }}
                  className="flex items-center justify-center h-10 w-full rounded-lg hover:bg-muted/60 active:scale-90 transition-all text-2xl"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Pack tabs at bottom - Telegram style */}
          <div className="flex items-center border-t border-border/30 overflow-x-auto no-scrollbar">
            {BUILT_IN_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setActivePack(pack.id)}
                className={cn(
                  "flex items-center justify-center min-w-[44px] h-9 text-lg transition-all",
                  activePack === pack.id
                    ? "bg-primary/10 border-b-2 border-primary"
                    : "hover:bg-muted/50"
                )}
              >
                {pack.icon}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
