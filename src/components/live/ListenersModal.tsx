import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Listener {
  id: string;
  user_id: string;
  role: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
  };
}

interface ListenersModalProps {
  listeners: Listener[];
  totalCount: number;
  isHost?: boolean;
  onPromote?: (speakerId: string) => void;
}

const LISTENERS_PER_PAGE = 20;

export const ListenersModal = ({ listeners, totalCount, isHost, onPromote }: ListenersModalProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  
  const totalPages = Math.ceil(listeners.length / LISTENERS_PER_PAGE);
  const startIndex = currentPage * LISTENERS_PER_PAGE;
  const endIndex = startIndex + LISTENERS_PER_PAGE;
  const currentListeners = listeners.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2">
          <Users className="w-3.5 h-3.5" />
          <span className="font-semibold">{totalCount}</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Listeners
            <Badge variant="secondary">{totalCount}</Badge>
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100%-120px)] mt-4">
          <div className="space-y-2">
            {currentListeners.map((listener) => (
              <div 
                key={listener.id} 
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={listener.profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/20">
                      {listener.profile?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {listener.profile?.display_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{listener.profile?.username || 'user'}
                    </p>
                  </div>
                </div>
                
                {isHost && onPromote && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onPromote(listener.id)}
                    className="text-xs"
                  >
                    Invite to Speak
                  </Button>
                )}
              </div>
            ))}
            
            {currentListeners.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No listeners yet
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 px-4">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
