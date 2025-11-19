import { Camera, ImagePlus, Pencil, Sparkles, X } from 'lucide-react';
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
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
      id: 'gallery' as const,
      icon: ImagePlus,
      title: 'Gallery',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    },
    {
      id: 'text' as const,
      icon: Pencil,
      title: 'Text',
      color: 'bg-gradient-to-br from-yellow-400 to-orange-500',
    },
    {
      id: 'ai-generate' as const,
      icon: Sparkles,
      title: 'AI Generate',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
      premium: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center animate-fade-in">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
        aria-label="Close"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Selector Grid */}
      <div className="grid grid-cols-2 gap-6 p-6 max-w-sm w-full">
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
              className={`flex flex-col items-center justify-center p-4 rounded-2xl shadow-xl ${method.color} text-white transition transform active:scale-95 ${
                isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
              }`}
            >
              <Icon className="w-8 h-8 mb-2" />
              <span className="text-sm font-semibold">{method.title}</span>
              {isLocked && (
                <span className="text-[10px] mt-1 bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  PRO
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
