import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Sticker {
  url: string;
  type: 'image' | 'video';
}

export interface StickerPack {
  id: string;
  name: string;
  thumbnail: string;
  stickers: Sticker[];
  isCustom?: boolean;
  createdAt?: number;
}

interface StickerStore {
  customPacks: StickerPack[];
  savedStickers: Sticker[]; // individual saved stickers from received messages

  addPack: (pack: StickerPack) => void;
  removePack: (packId: string) => void;
  addStickerToPack: (packId: string, sticker: Sticker) => void;
  removeStickerFromPack: (packId: string, stickerUrl: string) => void;
  renamePack: (packId: string, name: string) => void;

  saveSticker: (sticker: Sticker) => void;
  removeSavedSticker: (url: string) => void;
  isStickerSaved: (url: string) => boolean;

  createPackFromStickers: (name: string, stickers: Sticker[]) => StickerPack;
}

export const useStickerStore = create<StickerStore>()(
  persist(
    (set, get) => ({
      customPacks: [],
      savedStickers: [],

      addPack: (pack) =>
        set((s) => ({ customPacks: [...s.customPacks, { ...pack, isCustom: true, createdAt: Date.now() }] })),

      removePack: (packId) =>
        set((s) => ({ customPacks: s.customPacks.filter((p) => p.id !== packId) })),

      addStickerToPack: (packId, sticker) =>
        set((s) => ({
          customPacks: s.customPacks.map((p) =>
            p.id === packId && !p.stickers.some((st) => st.url === sticker.url)
              ? { ...p, stickers: [...p.stickers, sticker] }
              : p
          ),
        })),

      removeStickerFromPack: (packId, stickerUrl) =>
        set((s) => ({
          customPacks: s.customPacks.map((p) =>
            p.id === packId
              ? { ...p, stickers: p.stickers.filter((st) => st.url !== stickerUrl) }
              : p
          ),
        })),

      renamePack: (packId, name) =>
        set((s) => ({
          customPacks: s.customPacks.map((p) => (p.id === packId ? { ...p, name } : p)),
        })),

      saveSticker: (sticker) =>
        set((s) => {
          if (s.savedStickers.some((st) => st.url === sticker.url)) return s;
          return { savedStickers: [sticker, ...s.savedStickers] };
        }),

      removeSavedSticker: (url) =>
        set((s) => ({ savedStickers: s.savedStickers.filter((st) => st.url !== url) })),

      isStickerSaved: (url) => get().savedStickers.some((st) => st.url === url),

      createPackFromStickers: (name, stickers) => {
        const pack: StickerPack = {
          id: `custom-${Date.now()}`,
          name,
          thumbnail: stickers[0]?.url || '',
          stickers,
          isCustom: true,
          createdAt: Date.now(),
        };
        set((s) => ({ customPacks: [...s.customPacks, pack] }));
        return pack;
      },
    }),
    { name: 'feedin-sticker-store' }
  )
);
