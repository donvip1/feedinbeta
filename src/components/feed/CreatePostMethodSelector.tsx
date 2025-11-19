import { Camera, ImagePlus, Pencil, Sparkles, X, Lock } from 'lucide-react';
import { useEffect } from 'react';

interface CreatePostMethodSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectMethod: (method: 'camera' | 'gallery' | 'text' | 'ai-generate') => void;
  isPremium?: boolean;
}

export function CreatePostMethodSelector({
  open,
  onClose,
  onSelectMethod,
  isPremium = false,
}: CreatePostMethodSelectorProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [open]);

  if (!open) return null;

  const methods = [
    {
      id: 'camera' as const,
      icon: Camera,
      title: 'Camera',
      description: 'Capture a moment instantly',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
      id: 'gallery' as const,
      icon: ImagePlus,
      title: 'Gallery',
      description: 'Upload from your device',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    },
    {
      id: 'text' as const,
      icon: Pencil,
      title: 'Text Post',
      description: 'Share your thoughts',
      color: 'bg-gradient-to-br from-yellow-400 to-orange-500',
    },
    {
      id: 'ai-generate' as const,
      icon: Sparkles,
      title: 'AI Generator',
      description: 'Create content with AI',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
      premium: true,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-6 transition-opacity duration-300 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm mx-auto bg-gray-900 text-white rounded-3xl shadow-2xl transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Create New Post</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selection Grid */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            {methods.map((method) => {
              const Icon = method.icon;
              const isLocked = method.premium && !isPremium;
              const opacity = isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]';
              const premiumStyle = isLocked ? 'bg-gray-700/50' : method.color;

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
                  className={`relative flex flex-col items-start p-4 aspect-square rounded-2xl shadow-xl transition-all duration-200 transform focus:outline-none focus:ring-2 focus:ring-white/50 text-white ${premiumStyle} ${opacity}`}
                >
                  <div className="flex flex-col items-start h-full">
                    <div className="flex items-center mb-1">
                      <Icon className="w-8 h-8 mr-2" />
                      <span className="text-lg font-bold">{method.title}</span>
                    </div>
                    <span className="text-xs text-white/80 text-left mt-1">
                      {method.description}
                    </span>
                  </div>

                  {isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl">
                      <Lock className="w-6 h-6 text-white mb-1" />
                      <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
                        PRO
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Safe area padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}
