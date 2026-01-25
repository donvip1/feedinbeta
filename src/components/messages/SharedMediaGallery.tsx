import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSharedMedia, MediaItem, LinkItem } from '@/hooks/useSharedMedia';
import { Image, Video, FileText, Link2, Download, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ChatMediaViewer } from '@/components/messages/ChatMediaViewer';

interface SharedMediaGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  groupId?: string;
  title?: string;
}

export const SharedMediaGallery: React.FC<SharedMediaGalleryProps> = ({
  isOpen,
  onClose,
  conversationId,
  groupId,
  title = 'Shared Media',
}) => {
  const { photos, videos, files, links, loading, loadMore, hasMore } = useSharedMedia(conversationId, groupId);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);

  const handleLoadMore = async (type: 'photos' | 'videos' | 'files' | 'links') => {
    setLoadingMore(type);
    await loadMore(type);
    setLoadingMore(null);
  };

  const groupByMonth = (items: (MediaItem | LinkItem)[]) => {
    const groups: Record<string, (MediaItem | LinkItem)[]> = {};
    items.forEach(item => {
      const monthKey = format(new Date(item.createdAt), 'MMMM yyyy');
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(item);
    });
    return groups;
  };

  const renderPhotoGrid = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{month}</h4>
            <div className="grid grid-cols-3 gap-1">
              {(monthItems as MediaItem[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedMedia({ url: item.url, type: 'image' })}
                  className="aspect-square overflow-hidden rounded-md hover:opacity-80 transition-opacity"
                >
                  <img
                    src={item.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
        {hasMore.photos && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleLoadMore('photos')}
            disabled={loadingMore === 'photos'}
          >
            {loadingMore === 'photos' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        )}
      </div>
    );
  };

  const renderVideoGrid = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{month}</h4>
            <div className="grid grid-cols-2 gap-2">
              {(monthItems as MediaItem[]).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedMedia({ url: item.url, type: 'video' })}
                  className="aspect-video overflow-hidden rounded-lg bg-secondary relative hover:opacity-80 transition-opacity"
                >
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                      <Video className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {hasMore.videos && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleLoadMore('videos')}
            disabled={loadingMore === 'videos'}
          >
            {loadingMore === 'videos' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        )}
      </div>
    );
  };

  const renderFilesList = (items: MediaItem[]) => {
    const grouped = groupByMonth(items);
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{month}</h4>
            <div className="space-y-2">
              {(monthItems as MediaItem[]).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.fileName || 'File'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.senderName} · {format(new Date(item.createdAt), 'MMM d')}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => window.open(item.url, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {hasMore.files && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleLoadMore('files')}
            disabled={loadingMore === 'files'}
          >
            {loadingMore === 'files' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        )}
      </div>
    );
  };

  const renderLinksList = (items: LinkItem[]) => {
    const grouped = groupByMonth(items);
    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([month, monthItems]) => (
          <div key={month}>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">{month}</h4>
            <div className="space-y-2">
              {(monthItems as LinkItem[]).map((item) => {
                let hostname = '';
                try {
                  hostname = new URL(item.url).hostname;
                } catch {}
                
                return (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-primary">
                        {hostname || item.url}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.url}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.senderName} · {format(new Date(item.createdAt), 'MMM d')}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        ))}
        {hasMore.links && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => handleLoadMore('links')}
            disabled={loadingMore === 'links'}
          >
            {loadingMore === 'links' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Load More
          </Button>
        )}
      </div>
    );
  };

  const EmptyState = ({ icon: Icon, text }: { icon: React.ElementType; text: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="photos" className="flex flex-col h-[calc(100%-65px)]">
            <TabsList className="grid grid-cols-4 mx-4 mt-4">
              <TabsTrigger value="photos" className="text-xs">
                <Image className="w-4 h-4 mr-1" />
                Photos
              </TabsTrigger>
              <TabsTrigger value="videos" className="text-xs">
                <Video className="w-4 h-4 mr-1" />
                Videos
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs">
                <FileText className="w-4 h-4 mr-1" />
                Files
              </TabsTrigger>
              <TabsTrigger value="links" className="text-xs">
                <Link2 className="w-4 h-4 mr-1" />
                Links
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 px-4 py-4">
                <TabsContent value="photos" className="mt-0">
                  {photos.length > 0 ? renderPhotoGrid(photos) : (
                    <EmptyState icon={Image} text="No photos shared" />
                  )}
                </TabsContent>

                <TabsContent value="videos" className="mt-0">
                  {videos.length > 0 ? renderVideoGrid(videos) : (
                    <EmptyState icon={Video} text="No videos shared" />
                  )}
                </TabsContent>

                <TabsContent value="files" className="mt-0">
                  {files.length > 0 ? renderFilesList(files) : (
                    <EmptyState icon={FileText} text="No files shared" />
                  )}
                </TabsContent>

                <TabsContent value="links" className="mt-0">
                  {links.length > 0 ? renderLinksList(links) : (
                    <EmptyState icon={Link2} text="No links shared" />
                  )}
                </TabsContent>
              </ScrollArea>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

      {selectedMedia && (
        <ChatMediaViewer
          mediaUrl={selectedMedia.url}
          mediaType={selectedMedia.type}
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </>
  );
};
