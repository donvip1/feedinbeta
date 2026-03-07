import { useState } from 'react';
import { ArrowLeft, Search, Crown, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Viewer {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  is_co_broadcaster?: boolean;
  is_mic_on?: boolean;
  host_muted?: boolean;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
}

interface StreamGuestsProps {
  host: any;
  viewers: Viewer[];
  isHost: boolean;
  isMicOn: boolean;
  onBack: () => void;
  onNavigateToProfile: (userId: string) => void;
  onHostMuteToggle?: (viewer: Viewer) => void;
}

export const StreamGuests = ({
  host, viewers, isHost, isMicOn, onBack, onNavigateToProfile, onHostMuteToggle,
}: StreamGuestsProps) => {
  const [activeTab, setActiveTab] = useState('All');

  const sortedParticipants = [
    ...(host ? [{ id: host.id, user_id: host.id, role: 'host', is_muted: !isMicOn, has_raised_hand: false, profile: host }] : []),
    ...viewers.filter(v => v.user_id !== host?.id),
  ];

  const filtered = sortedParticipants.filter(s => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Speakers') return s.role === 'host' || s.role === 'speaker';
    if (activeTab === 'Listening') return s.role === 'listener';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex flex-col min-h-[100dvh]"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', overscrollBehavior: 'none', transform: 'translateZ(0)' }}>
      <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between pt-safe">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/5">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-white font-black text-lg">Guests</h2>
        <div className="w-9" />
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center bg-white/5 rounded-2xl px-4 py-3 border border-white/5">
          <Search className="w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search guests" className="flex-1 bg-transparent text-white placeholder-white/30 outline-none ml-3 text-sm" />
        </div>
      </div>

      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {['All', 'Speakers', 'Listening'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all',
              activeTab === tab ? 'bg-rose-500 text-white' : 'bg-white/5 text-white/50 border border-white/5')}>
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-safe">
        {host && (activeTab === 'All' || activeTab === 'Speakers') && (
          <div className="px-4 py-3">
            <h3 className="text-white/30 text-xs font-black uppercase tracking-wider mb-3">Host</h3>
            <button onClick={() => onNavigateToProfile(host.id)}
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer w-full text-left transition-colors">
              <img src={host.avatar_url || ''} alt="host" className="w-12 h-12 rounded-full ring-2 ring-rose-500" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate flex items-center gap-1.5">
                  {host.display_name}
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-current" />
                </p>
                <p className="text-white/30 text-sm">@{host.username}</p>
              </div>
            </button>
          </div>
        )}

        {filtered.filter(s => s.role === 'listener').length > 0 && (
          <div className="px-4 py-3">
            <h3 className="text-white/30 text-xs font-black uppercase tracking-wider mb-3">
              Listeners ({filtered.filter(s => s.role === 'listener').length})
            </h3>
            <div className="space-y-1">
              {filtered.filter(s => s.role === 'listener').map(viewer => (
                <button key={viewer.id} onClick={() => onNavigateToProfile(viewer.user_id)}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 cursor-pointer w-full text-left transition-colors">
                  <img src={viewer.profile?.avatar_url || ''} alt={viewer.profile?.display_name} className="w-11 h-11 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{viewer.profile?.display_name}</p>
                    <p className="text-white/30 text-sm">@{viewer.profile?.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import { useState } from 'react';
