import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Video, Mic, ChevronDown } from 'lucide-react';

interface GoLiveDropdownProps {
  onVideoStream: () => void;
  onAudioSpace: () => void;
}

export const GoLiveDropdown = ({ onVideoStream, onAudioSpace }: GoLiveDropdownProps) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4" />
          Go Live
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-background border border-border shadow-lg z-50">
        <DropdownMenuItem 
          onClick={() => {
            setOpen(false);
            onVideoStream();
          }}
          className="cursor-pointer flex items-center gap-3 py-3 px-4"
        >
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <Video className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Go Live (Video)</p>
            <p className="text-xs text-muted-foreground">Stream video to your audience</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => {
            setOpen(false);
            onAudioSpace();
          }}
          className="cursor-pointer flex items-center gap-3 py-3 px-4"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Start a Space (Audio)</p>
            <p className="text-xs text-muted-foreground">Host a live audio conversation</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
