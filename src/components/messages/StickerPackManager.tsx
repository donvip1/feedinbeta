import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Upload, ImagePlus, Package, X, Edit2, Check } from 'lucide-react';
import { useStickerStore, StickerPack, Sticker } from '@/stores/stickerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StickerPackManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StickerPackManager = ({ isOpen, onClose }: StickerPackManagerProps) => {
  const { customPacks, savedStickers, addPack, removePack, addStickerToPack, removeStickerFromPack, renamePack, removeSavedSticker, createPackFromStickers } = useStickerStore();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [newPackName, setNewPackName] = useState('');
  const [pendingStickers, setPendingStickers] = useState<Sticker[]>([]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null, target: 'pending' | string) => {
    if (!files) return;
    const newStickers: Sticker[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
      const url = URL.createObjectURL(file);
      newStickers.push({ url, type: file.type.startsWith('video/') ? 'video' : 'image' });
    });
    if (target === 'pending') {
      setPendingStickers((prev) => [...prev, ...newStickers]);
    } else {
      newStickers.forEach((s) => addStickerToPack(target, s));
      toast.success(`Added ${newStickers.length} sticker(s)`);
    }
  };

  const handleCreatePack = () => {
    if (!newPackName.trim()) { toast.error('Enter a pack name'); return; }
    if (pendingStickers.length === 0) { toast.error('Add at least one sticker'); return; }
    createPackFromStickers(newPackName.trim(), pendingStickers);
    toast.success(`Pack "${newPackName}" created!`);
    setNewPackName('');
    setPendingStickers([]);
    setView('list');
  };

  const handleCreateFromSaved = () => {
    if (savedStickers.length === 0) { toast.error('No saved stickers'); return; }
    createPackFromStickers('Saved Stickers', [...savedStickers]);
    toast.success('Pack created from saved stickers!');
  };

  const startRename = (pack: StickerPack) => {
    setEditingName(pack.id);
    setEditNameValue(pack.name);
  };

  const confirmRename = (packId: string) => {
    if (editNameValue.trim()) renamePack(packId, editNameValue.trim());
    setEditingName(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {view === 'list' && 'Sticker Packs'}
            {view === 'create' && 'Create Sticker Pack'}
            {view === 'detail' && selectedPack?.name}
          </DialogTitle>
        </DialogHeader>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => setView('create')}>
                <Plus className="w-4 h-4 mr-1" /> New Pack
              </Button>
              {savedStickers.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleCreateFromSaved}>
                  <Package className="w-4 h-4 mr-1" /> From Saved ({savedStickers.length})
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 max-h-[50vh]">
              {customPacks.length === 0 ? (
                <div className="text-center text-muted-foreground py-12 text-sm">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  No custom packs yet
                </div>
              ) : (
                <div className="space-y-2">
                  {customPacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      {pack.thumbnail ? (
                        <img src={pack.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <Package className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {editingName === pack.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && confirmRename(pack.id)}
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => confirmRename(pack.id)}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">{pack.name}</p>
                            <p className="text-xs text-muted-foreground">{pack.stickers.length} stickers</p>
                          </>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startRename(pack)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedPack(pack); setView('detail'); }}>
                          <ImagePlus className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { removePack(pack.id); toast.success('Pack deleted'); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved stickers section */}
              {savedStickers.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Saved Stickers
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {savedStickers.map((s, i) => (
                      <div key={i} className="relative group">
                        <img src={s.url} alt="" className="w-full aspect-square object-contain rounded-lg" />
                        <button
                          onClick={() => removeSavedSticker(s.url)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* CREATE VIEW */}
        {view === 'create' && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <Input
              placeholder="Pack name..."
              value={newPackName}
              onChange={(e) => setNewPackName(e.target.value)}
            />

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="w-4 h-4 mr-1" /> Add Stickers
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => bulkInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Bulk Upload
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, 'pending')}
            />
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, 'pending')}
            />

            <ScrollArea className="flex-1 max-h-[40vh]">
              {pendingStickers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  Add stickers to your pack
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {pendingStickers.map((s, i) => (
                    <div key={i} className="relative group aspect-square">
                      {s.type === 'video' ? (
                        <video src={s.url} autoPlay loop muted playsInline className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <img src={s.url} alt="" className="w-full h-full object-contain rounded-lg" />
                      )}
                      <button
                        onClick={() => setPendingStickers((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setView('list'); setPendingStickers([]); setNewPackName(''); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreatePack} disabled={!newPackName.trim() || pendingStickers.length === 0}>
                Create Pack ({pendingStickers.length})
              </Button>
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {view === 'detail' && selectedPack && (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus className="w-4 h-4 mr-1" /> Add More Stickers
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files, selectedPack.id);
                // refresh selected pack view
                const updated = useStickerStore.getState().customPacks.find((p) => p.id === selectedPack.id);
                if (updated) setSelectedPack(updated);
              }}
            />

            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="grid grid-cols-4 gap-2">
                {selectedPack.stickers.map((s, i) => (
                  <div key={i} className="relative group aspect-square">
                    {s.type === 'video' ? (
                      <video src={s.url} autoPlay loop muted playsInline className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <img src={s.url} alt="" className="w-full h-full object-contain rounded-lg" />
                    )}
                    <button
                      onClick={() => {
                        removeStickerFromPack(selectedPack.id, s.url);
                        setSelectedPack({ ...selectedPack, stickers: selectedPack.stickers.filter((st) => st.url !== s.url) });
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button variant="outline" onClick={() => { setView('list'); setSelectedPack(null); }}>
              ← Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
