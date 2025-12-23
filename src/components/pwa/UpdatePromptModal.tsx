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
import { Download, RefreshCw } from 'lucide-react';

interface UpdatePromptModalProps {
  open: boolean;
  onUpdate: () => void;
  onLater: () => void;
}

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
            <div className="p-3 rounded-full bg-primary/10">
              <Download className="w-8 h-8 text-primary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center">Update Available!</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            A new version of FeedIn is available with improvements and bug fixes. 
            Update now for the best experience.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction 
            onClick={onUpdate}
            className="w-full gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Update Now
          </AlertDialogAction>
          <AlertDialogCancel 
            onClick={onLater}
            className="w-full mt-0"
          >
            Later
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
