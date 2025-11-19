import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Camera, Image, Type, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreatePostMethodSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'camera' | 'gallery' | 'text-to-image' | 'ai-generate') => void;
  isPremium?: boolean;
}

export function CreatePostMethodSelector({
  open,
  onClose,
  onSelectMethod,
  isPremium = false,
}: CreatePostMethodSelectorProps) {
  const methods = [
    {
      id: 'camera' as const,
      icon: Camera,
      title: 'Camera',
      description: 'Capture photo, video, or text',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'ai-generate' as const,
      icon: Sparkles,
      title: 'AI Generate',
      description: 'Create with AI',
      color: 'from-green-500 to-emerald-500',
      premium: true,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-md mx-auto">
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">Create Post</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Choose how you want to create your post</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const isLocked = method.premium && !isPremium;

            return (
              <Button
                key={method.id}
                variant="outline"
                className="h-auto flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 relative group hover:border-primary"
                onClick={() => !isLocked && onSelectMethod(method.id)}
                disabled={isLocked}
              >
                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${method.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-xs sm:text-sm">{method.title}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 leading-tight">{method.description}</p>
                </div>
                {method.premium && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
                    <span className="text-[10px] sm:text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-semibold">
                      PRO
                    </span>
                  </div>
                )}
                {isLocked && (
                  <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                    <p className="text-[10px] sm:text-xs font-semibold">Subscribe to unlock</p>
                  </div>
                )}
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
