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
      <DialogContent className="max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Create Post</h2>
          <p className="text-sm text-muted-foreground">Choose how you want to create your post</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const isLocked = method.premium && !isPremium;

            return (
              <Button
                key={method.id}
                variant="outline"
                className="h-auto flex flex-col items-center gap-3 p-6 relative group hover:border-primary"
                onClick={() => !isLocked && onSelectMethod(method.id)}
                disabled={isLocked}
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${method.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">{method.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{method.description}</p>
                </div>
                {method.premium && (
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 py-1 rounded-full font-semibold">
                      PRO
                    </span>
                  </div>
                )}
                {isLocked && (
                  <div className="absolute inset-0 bg-background/80 rounded-lg flex items-center justify-center">
                    <p className="text-xs font-semibold">Subscribe to unlock</p>
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
