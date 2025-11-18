import { FileText, Image, Video, Radio, Layers, Wallet, Zap, ShoppingBag, Camera, UsersRound, Sparkles, Wand2, BookOpen, X, GraduationCap } from 'lucide-react';

interface QuickActionsModalProps {
  open: boolean;
  onClose: () => void;
  onActionSelect: (action: string) => void;
  context?: 'feed' | 'ai' | 'default';
}

// Feed context actions
const feedActions = [
  { id: 'thoughts', label: 'Share Thoughts', icon: FileText, color: 'from-blue-500 to-blue-600' },
  { id: 'story', label: 'Create Story', icon: Camera, color: 'from-pink-500 to-purple-500' },
  { id: 'learn-tech', label: 'Learn Tech', icon: GraduationCap, color: 'from-emerald-500 to-teal-500' },
];

// AI context actions
const aiActions = [
  { id: 'image-enhancement', label: 'Enhance Image', icon: Sparkles, color: 'from-purple-500 to-pink-500' },
  { id: 'image-generation', label: 'Generate Image', icon: Wand2, color: 'from-pink-500 to-purple-500' },
  { id: 'project-writing', label: 'Write Project', icon: BookOpen, color: 'from-indigo-500 to-purple-600' },
  { id: 'thesis-writer', label: 'Write Thesis', icon: BookOpen, color: 'from-red-500 to-pink-600' },
  { id: 'video-creation', label: 'Create Video', icon: Video, color: 'from-teal-500 to-cyan-500' },
  { id: 'educational-qa', label: 'Educational Q&A', icon: Zap, color: 'from-yellow-500 to-orange-500' },
];

export const QuickActionsModal = ({ open, onClose, onActionSelect, context = 'default' }: QuickActionsModalProps) => {
  if (!open) return null;

  // Select actions based on context
  const actions = context === 'ai' ? aiActions : feedActions;
  const title = context === 'ai' ? 'AI Tools' : 'Quick Actions';

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal positioned above nav bar */}
      <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4 animate-in slide-in-from-bottom duration-300">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-2xl mx-auto shadow-2xl max-h-[70vh] overflow-y-auto">
          <div className="py-6 px-4 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-6">{title}</h2>
            
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      onActionSelect(action.id);
                      onClose();
                    }}
                    className="bg-gray-800/50 hover:bg-gray-800 rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 transition-all hover:scale-105 active:scale-95"
                  >
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white font-medium text-center text-xs">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
