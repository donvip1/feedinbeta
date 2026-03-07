import React, { useState } from 'react';
import { X, Plus, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useStickerStore, Sticker } from '@/stores/stickerStore';
import { StickerPackManager } from './StickerPackManager';

interface StickerPack {
  id: string;
  name: string;
  thumbnail: string;
  stickers: Sticker[];
  isCustom?: boolean;
}

const BUILT_IN_STICKER_PACKS: StickerPack[] = [
  {
    id: 'pepe',
    name: 'Pepe',
    thumbnail: 'https://em-content.zobj.net/source/telegram/386/frog_1f438.webp',
    stickers: [
      { url: 'https://em-content.zobj.net/source/telegram/386/frog_1f438.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/crying-face_1f622.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/face-with-tears-of-joy_1f602.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/thinking-face_1f914.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/smiling-face-with-heart-eyes_1f60d.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/face-with-steam-from-nose_1f624.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/sleeping-face_1f634.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/waving-hand_1f44b.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/thumbs-up_1f44d.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/clapping-hands_1f44f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/fire_1f525.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/party-popper_1f389.webp', type: 'image' },
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts',
    thumbnail: 'https://em-content.zobj.net/source/telegram/386/red-heart_2764-fe0f.webp',
    stickers: [
      { url: 'https://em-content.zobj.net/source/telegram/386/red-heart_2764-fe0f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/orange-heart_1f9e1.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/yellow-heart_1f49b.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/green-heart_1f49a.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/blue-heart_1f499.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/purple-heart_1f49c.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/sparkling-heart_1f496.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/growing-heart_1f497.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/beating-heart_1f493.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/revolving-hearts_1f49e.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/heart-with-arrow_1f498.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/kiss-mark_1f48b.webp', type: 'image' },
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    thumbnail: 'https://em-content.zobj.net/source/telegram/386/cat-face_1f431.webp',
    stickers: [
      { url: 'https://em-content.zobj.net/source/telegram/386/cat-face_1f431.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/dog-face_1f436.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/bear_1f43b.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/panda_1f43c.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/fox_1f98a.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/lion_1f981.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/unicorn_1f984.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/monkey-face_1f435.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/penguin_1f427.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/chicken_1f414.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/butterfly_1f98b.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/turtle_1f422.webp', type: 'image' },
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    thumbnail: 'https://em-content.zobj.net/source/telegram/386/ok-hand_1f44c.webp',
    stickers: [
      { url: 'https://em-content.zobj.net/source/telegram/386/ok-hand_1f44c.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/victory-hand_270c-fe0f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/crossed-fingers_1f91e.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/flexed-biceps_1f4aa.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/folded-hands_1f64f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/handshake_1f91d.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/raising-hands_1f64c.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/oncoming-fist_1f44a.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/call-me-hand_1f919.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/pinching-hand_1f90f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/love-you-gesture_1f91f.webp', type: 'image' },
      { url: 'https://em-content.zobj.net/source/telegram/386/sign-of-the-horns_1f918.webp', type: 'image' },
    ],
  },
];

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerUrl: string, type: 'image' | 'video') => void;
}

export const StickerPicker = ({ isOpen, onClose, onSelectSticker }: StickerPickerProps) => {
  const { customPacks, savedStickers } = useStickerStore();
  const [activePack, setActivePack] = useState(BUILT_IN_STICKER_PACKS[0].id);
  const [showManager, setShowManager] = useState(false);

  // Build saved stickers as a virtual pack
  const savedPack: StickerPack | null = savedStickers.length > 0
    ? { id: '_saved', name: 'Saved', thumbnail: savedStickers[0].url, stickers: savedStickers }
    : null;

  const allPacks: StickerPack[] = [
    ...(savedPack ? [savedPack] : []),
    ...BUILT_IN_STICKER_PACKS,
    ...customPacks,
  ];

  const currentPack = allPacks.find((p) => p.id === activePack) || allPacks[0];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 320 }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-card border-t border-border/50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {currentPack?.name || 'Stickers'}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowManager(true)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Sticker grid */}
            <ScrollArea className="h-[240px]">
              <div className="grid grid-cols-4 gap-2 p-3">
                {currentPack?.stickers.map((sticker, i) => (
                  <button
                    key={`${activePack}-${i}`}
                    onClick={() => {
                      onSelectSticker(sticker.url, sticker.type);
                      onClose();
                    }}
                    className="flex items-center justify-center aspect-square rounded-xl hover:bg-muted/60 active:scale-90 transition-all p-2"
                  >
                    {sticker.type === 'video' ? (
                      <video src={sticker.url} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                    ) : (
                      <img src={sticker.url} alt="sticker" className="w-full h-full object-contain" loading="lazy" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Pack tabs */}
            <div className="flex items-center border-t border-border/30 overflow-x-auto no-scrollbar">
              {allPacks.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setActivePack(pack.id)}
                  className={cn(
                    'flex items-center justify-center min-w-[48px] h-10 transition-all p-1.5',
                    activePack === pack.id
                      ? 'bg-primary/10 border-b-2 border-primary'
                      : 'hover:bg-muted/50'
                  )}
                >
                  {pack.id === '_saved' ? (
                    <Bookmark className="w-5 h-5 text-primary fill-primary" />
                  ) : pack.thumbnail ? (
                    <img src={pack.thumbnail} alt={pack.name} className="w-6 h-6 object-contain rounded" loading="lazy" />
                  ) : (
                    <span className="text-xs font-medium truncate max-w-[40px]">{pack.name.slice(0, 2)}</span>
                  )}
                </button>
              ))}

              {/* Add pack button in tabs */}
              <button
                onClick={() => setShowManager(true)}
                className="flex items-center justify-center min-w-[48px] h-10 hover:bg-muted/50 transition-all p-1.5"
              >
                <Plus className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <StickerPackManager isOpen={showManager} onClose={() => setShowManager(false)} />
    </>
  );
};
