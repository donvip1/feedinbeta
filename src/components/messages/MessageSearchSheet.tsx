import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, X, Image as ImageIcon, Video, Mic, FileText, 
  Calendar as CalendarIcon, User, ChevronDown, Loader2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useMessageSearch, SearchFilters, SearchResult, highlightSearchTerm, getMediaTypeLabel } from '@/hooks/useMessageSearch';

interface MessageSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  groupId?: string;
  participants?: Array<{ id: string; name: string; avatar?: string | null }>;
  onResultClick?: (messageId: string) => void;
}

const MEDIA_FILTERS = [
  { value: null, label: 'All', icon: null },
  { value: 'image', label: 'Images', icon: ImageIcon },
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'audio', label: 'Audio', icon: Mic },
  { value: 'file', label: 'Files', icon: FileText },
  { value: 'all_media', label: 'Media', icon: ImageIcon },
] as const;

export const MessageSearchSheet = ({
  open,
  onOpenChange,
  conversationId,
  groupId,
  participants = [],
  onResultClick,
}: MessageSearchSheetProps) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    mediaType: null,
    senderId: null,
    startDate: null,
    endDate: null,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSenderPicker, setShowSenderPicker] = useState(false);
  
  const { results, isLoading, hasSearched, hasMore, search, loadMore, reset } = useMessageSearch({
    conversationId,
    groupId,
  });

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.query.trim() || filters.mediaType || filters.senderId || filters.startDate) {
        search(filters);
      } else if (hasSearched) {
        reset();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [filters]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      setFilters({
        query: '',
        mediaType: null,
        senderId: null,
        startDate: null,
        endDate: null,
      });
      reset();
    }
  }, [open]);

  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result.id);
    onOpenChange(false);
  };

  const getSelectedSender = () => {
    if (!filters.senderId) return null;
    return participants.find(p => p.id === filters.senderId);
  };

  const clearFilters = () => {
    setFilters({
      query: '',
      mediaType: null,
      senderId: null,
      startDate: null,
      endDate: null,
    });
  };

  const hasActiveFilters = filters.mediaType || filters.senderId || filters.startDate || filters.endDate;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-background p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X className="w-5 h-5" />
            </Button>
            <SheetTitle className="flex-1">Search Messages</SheetTitle>
          </div>
        </SheetHeader>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={filters.query}
              onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
              className="pl-9 pr-9"
              autoFocus
            />
            {filters.query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setFilters(prev => ({ ...prev, query: '' }))}
                type="button"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="p-3 border-b border-border space-y-3">
          {/* Media Type Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {MEDIA_FILTERS.map(filter => {
              const Icon = filter.icon;
              const isActive = filters.mediaType === filter.value;
              return (
                <Button
                  key={filter.value || 'all'}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    "flex-shrink-0 gap-1.5 h-8",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    mediaType: prev.mediaType === filter.value ? null : filter.value as any 
                  }))}
                  type="button"
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {filter.label}
                </Button>
              );
            })}
          </div>

          {/* Date and Sender Filters */}
          <div className="flex items-center gap-2">
            {/* Date Range */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant={filters.startDate ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5 h-8"
                  type="button"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {filters.startDate 
                    ? format(filters.startDate, 'MMM d') + (filters.endDate ? ` - ${format(filters.endDate, 'MMM d')}` : '')
                    : 'Date'}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.startDate || undefined,
                    to: filters.endDate || undefined,
                  }}
                  onSelect={(range) => {
                    setFilters(prev => ({
                      ...prev,
                      startDate: range?.from || null,
                      endDate: range?.to || null,
                    }));
                  }}
                  numberOfMonths={1}
                />
                <div className="p-2 border-t border-border flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, startDate: null, endDate: null }));
                      setShowDatePicker(false);
                    }}
                    type="button"
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowDatePicker(false)}
                    type="button"
                  >
                    Done
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sender Filter */}
            {participants.length > 0 && (
              <Popover open={showSenderPicker} onOpenChange={setShowSenderPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant={filters.senderId ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5 h-8"
                    type="button"
                  >
                    <User className="w-3.5 h-3.5" />
                    {getSelectedSender()?.name || 'From'}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-9"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, senderId: null }));
                      setShowSenderPicker(false);
                    }}
                    type="button"
                  >
                    <User className="w-4 h-4 text-muted-foreground" />
                    Anyone
                  </Button>
                  {participants.map(p => (
                    <Button
                      key={p.id}
                      variant={filters.senderId === p.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start gap-2 h-9"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, senderId: p.id }));
                        setShowSenderPicker(false);
                      }}
                      type="button"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={p.avatar || ''} />
                        <AvatarFallback className="text-[10px]">
                          {p.name?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{p.name}</span>
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={clearFilters}
                type="button"
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading && results.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && hasSearched && results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No messages found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}

            {!hasSearched && !isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Search for messages</p>
                <p className="text-sm mt-1">Enter a keyword or use filters</p>
              </div>
            )}

            {results.map(result => (
              <button
                key={result.id}
                type="button"
                className="w-full p-3 rounded-xl hover:bg-accent/50 transition-colors text-left flex items-start gap-3 group"
                onClick={() => handleResultClick(result)}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={result.sender_avatar || ''} />
                  <AvatarFallback className="bg-primary/10 text-sm">
                    {result.sender_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">
                      {result.sender_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(result.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  {result.media_url && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      {result.media_type?.startsWith('image') && <ImageIcon className="w-3.5 h-3.5" />}
                      {result.media_type?.startsWith('video') && <Video className="w-3.5 h-3.5" />}
                      {result.media_type?.startsWith('audio') && <Mic className="w-3.5 h-3.5" />}
                      {!result.media_type?.match(/^(image|video|audio)/) && <FileText className="w-3.5 h-3.5" />}
                      <span>{getMediaTypeLabel(result.media_type?.split('/')[0] || 'file')}</span>
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {highlightSearchTerm(result.content || '', filters.query)}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-3" />
              </button>
            ))}

            {/* Load More */}
            {hasMore && results.length > 0 && (
              <div className="py-4 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadMore(filters)}
                  disabled={isLoading}
                  type="button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default MessageSearchSheet;
