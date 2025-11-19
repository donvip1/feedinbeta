import { Camera, Image as ImageIcon, Type, Sparkles, X } from 'lucide-react';

interface CreatePostMethodSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'camera' | 'gallery' | 'text-to-image' | 'ai-generate' | 'text') => void;
  isPremium?: boolean;
}

export function CreatePostMethodSelector({
  open,
  onClose,
  onSelectMethod,
  isPremium = false,
}: CreatePostMethodSelectorProps) {
  if (!open) return null;

  const methods = [
    {
      id: 'camera' as const,
      icon: Camera,
      title: 'Camera',
      description: 'Take photo or video',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'gallery' as const,
      icon: ImageIcon,
      title: 'Gallery',
      description: 'Choose from device',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      id: 'text' as const,
      icon: Type,
      title: 'Text',
      description: 'Create a text post',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      id: 'ai-generate' as const,
      icon: Sparkles,
      title: 'AI Generate',
      description: 'Create with AI',
      gradient: 'from-green-500 to-emerald-500',
      premium: true,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-background rounded-t-3xl max-w-2xl mx-auto shadow-2xl overflow-hidden">
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2">
            <h2 className="text-lg font-bold text-foreground">Create Post</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Options Grid */}
          <div className="px-4 py-2 pb-6">
            <div className="grid grid-cols-2 gap-3">
              {methods.map((method) => {
                const Icon = method.icon;
                const isLocked = method.premium && !isPremium;

                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      if (!isLocked) {
                        onSelectMethod(method.id);
                      }
                    }}
                    disabled={isLocked}
                    className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden group"
                  >
                    {/* Gradient Icon Container */}
                    <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${method.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                      
                      {/* Premium Badge */}
                      {method.premium && (
                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md">
                          PRO
                        </div>
                      )}
                    </div>

                    {/* Text Content */}
                    <div className="text-center">
                      <h3 className="text-sm font-semibold text-foreground">{method.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{method.description}</p>
                    </div>

                    {/* Lock Overlay for Premium */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center gap-1">
                        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs font-semibold text-foreground">Premium</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
