import React, { useState } from 'react';
import { ArrowLeft, Search, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Speaker {
  id: string;
  user_id: string;
  role: string;
  is_muted: boolean;
  has_raised_hand: boolean;
  profile?: {
    display_name: string;
    username: string;
    avatar_url: string;
    is_verified?: boolean;
  };
}

interface TwitterSpaceGuestsProps {
  speakers: Speaker[];
  spaceId: string;
  isHost: boolean;
  onClose: () => void;
  audioLevels: Record<string, number>;
}

type TabType = 'All' | 'Co-hosts' | 'Speakers' | 'Listening';

export const TwitterSpaceGuests = ({
  speakers,
  spaceId,
  isHost,
  onClose,
  audioLevels,
}: TwitterSpaceGuestsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: TabType[] = ['All', 'Co-hosts', 'Speakers', 'Listening'];

  const filteredSpeakers = speakers.filter(speaker => {
    const matchesSearch = 
      speaker.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      speaker.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'Co-hosts':
        return speaker.role === 'co_host';
      case 'Speakers':
        return speaker.role === 'speaker' || speaker.role === 'host' || speaker.role === 'co_host';
      case 'Listening':
        return speaker.role === 'listener';
      default:
        return true;
    }
  });

  const hosts = filteredSpeakers.filter(s => s.role === 'host');
  const coHosts = filteredSpeakers.filter(s => s.role === 'co_host');
  const speakersOnly = filteredSpeakers.filter(s => s.role === 'speaker');
  const listeners = filteredSpeakers.filter(s => s.role === 'listener');

  const speakerCount = [...hosts, ...coHosts, ...speakersOnly].length;
  const listenerCount = listeners.length;

  const renderUserItem = (speaker: Speaker) => (
    <div 
      key={speaker.id}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
        {speaker.profile?.avatar_url ? (
          <img 
            src={speaker.profile.avatar_url} 
            alt={speaker.profile.display_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-lg font-semibold">
            {speaker.profile?.display_name?.[0] || 'U'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-white font-medium truncate">
            {speaker.profile?.display_name || 'User'}
          </span>
          {speaker.profile?.is_verified && (
            <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
        </div>
        <span className="text-zinc-500 text-sm">@{speaker.profile?.username || 'user'}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-zinc-800">
        <button onClick={onClose} className="p-2 text-white hover:bg-zinc-800 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white text-lg font-bold">Guests</h1>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900 border-zinc-800 pl-10 text-white placeholder:text-zinc-500 rounded-full"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab 
                ? "bg-purple-600 border-transparent text-white" 
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4">
        {/* Host Section */}
        {hosts.length > 0 && (activeTab === 'All' || activeTab === 'Speakers') && (
          <div className="mb-6">
            <h2 className="text-zinc-500 text-sm font-medium mb-2">Host</h2>
            {hosts.map(renderUserItem)}
          </div>
        )}

        {/* Co-Hosts Section */}
        {coHosts.length > 0 && (activeTab === 'All' || activeTab === 'Co-hosts' || activeTab === 'Speakers') && (
          <div className="mb-6">
            <h2 className="text-zinc-500 text-sm font-medium mb-2">Co-hosts</h2>
            {coHosts.map(renderUserItem)}
          </div>
        )}

        {/* Speakers Section */}
        {speakersOnly.length > 0 && (activeTab === 'All' || activeTab === 'Speakers') && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-zinc-500 text-sm font-medium">Speakers</h2>
              <span className="text-zinc-600 text-xs">{speakersOnly.length} speakers • 8 open spots</span>
            </div>
            {speakersOnly.map(renderUserItem)}
          </div>
        )}

        {/* Listeners Section */}
        {listeners.length > 0 && (activeTab === 'All' || activeTab === 'Listening') && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-zinc-500 text-sm font-medium">Listeners</h2>
              <span className="text-zinc-600 text-xs">{listenerCount} people are listening</span>
            </div>
            {listeners.map(renderUserItem)}
          </div>
        )}

        {filteredSpeakers.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            No users found
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
