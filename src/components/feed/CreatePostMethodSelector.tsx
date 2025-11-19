import { Camera, Sparkles, X } from 'lucide-react';

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
  if (!open) return null;

  const methods = [
    {
      id: 'camera' as const,
      icon: Camera,
      title: 'Camera',
      description: 'Capture photo, video, or text',
      color: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    },
    {
      id: 'ai-generate' as const,
      icon: Sparkles,
      title: 'AI Generate',
      description: 'Create with AI',
      color: 'bg-gradient-to-r from-green-500 to-emerald-500',
      premium: true,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-background border-t border-border rounded-t-3xl max-w-2xl mx-auto shadow-2xl">
          {/* Handle Bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Create Post</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Options List */}
          <div className="px-4 py-3 space-y-2 pb-safe">
            {methods.map((method) => {
              const Icon = method.icon;
              const isLocked = method.premium && !isPremium;

              return (
                <button
                  key={method.id}
                  onClick={() => {
                    if (!isLocked) {
                      onSelectMethod(method.id);
                      onClose();
                    }
                  }}
                  disabled={isLocked}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-full ${method.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{method.title}</h3>
                      {method.premium && (
                        <span className="text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                          PRO
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{method.description}</p>
                    {isLocked && (
                      <p className="text-xs text-primary mt-1 font-medium">Subscribe to unlock</p>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  <div className="text-muted-foreground">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Safe area padding for mobile devices */}
          <div className="h-4 md:h-6" />
        </div>
      </div>
    </>
  );
}
