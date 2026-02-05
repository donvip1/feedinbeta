import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, RefreshCw, Sparkles, Zap, Bug, Shield, Rocket, HardDrive } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UpdatePromptModalProps {
  open: boolean;
  onUpdate: () => void;
  onLater: () => void;
}

// Latest update changelog - update this with each deployment
const LATEST_UPDATES = [
  { icon: Sparkles, text: 'Auto-logout when host ends live' },
  { icon: Zap, text: 'Self mute/unmute for speakers' },
  { icon: Bug, text: 'Live spaces properly end in database' },
  { icon: Shield, text: 'Improved send button spacing' },
  { icon: Rocket, text: 'End/Leave button labels fixed' },
  { icon: HardDrive, text: 'Mute All toggle with unmute' },
];

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  open,
  onUpdate,
  onLater,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onLater()}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10 animate-pulse">
              <Download className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-lg">
            New Update Available! 🎉
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-sm">
            A new version of FeedIn is ready with these improvements:
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {/* What's New Section */}
        <ScrollArea className="max-h-40 mt-2">
          <div className="space-y-2 px-1">
            {LATEST_UPDATES.map((update, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <update.icon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-foreground">{update.text}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col mt-4">
          <AlertDialogAction 
            onClick={onUpdate}
            className="w-full gap-2 bg-primary hover:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Update Now
          </AlertDialogAction>
          <AlertDialogCancel 
            onClick={onLater}
            className="w-full mt-0 text-muted-foreground"
          >
            Remind me later
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};