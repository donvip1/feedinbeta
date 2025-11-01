import { FileText, Image, Video, Radio, Layers, Wallet, Zap, ShoppingBag } from 'lucide-react';

interface QuickActionsModalProps {
  open: boolean;
  onClose: () => void;
  onActionSelect: (action: string) => void;
}

const quickActions = [
  { id: 'thoughts', label: 'Share Thoughts', icon: FileText, color: 'from-blue-500 to-blue-600' },
  { id: 'photo', label: 'Share Photo', icon: Image, color: 'from-purple-500 to-pink-500' },
  { id: 'video', label: 'Share Video', icon: Video, color: 'from-orange-500 to-red-500' },
  { id: 'livestream', label: 'Start Livestream', icon: Radio, color: 'from-red-500 to-pink-600' },
  { id: 'p2p', label: 'P2P Trade', icon: Layers, color: 'from-teal-500 to-cyan-500' },
  { id: 'credits', label: 'Buy Credits', icon: Wallet, color: 'from-yellow-500 to-orange-500' },
  { id: 'ai', label: 'AI Assistant', icon: Zap, color: 'from-blue-400 to-cyan-400' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, color: 'from-green-500 to-emerald-600' },
];

export const QuickActionsModal = ({ open, onClose, onActionSelect }: QuickActionsModalProps) => {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal positioned above nav bar */}
      <div className="fixed bottom-20 left-0 right-0 z-50 px-4 pb-4">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-2xl mx-auto shadow-2xl max-h-[70vh] overflow-y-auto">
          <div className="py-6 px-4">
            <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-6">Quick Actions</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={() => {
                      onActionSelect(action.id);
                      onClose();
                    }}
                    className="bg-gray-800/50 hover:bg-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 transition-all hover:scale-105"
                  >
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-white font-medium">{action.label}</span>
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
