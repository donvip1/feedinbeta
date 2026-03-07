import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Coins, MessageSquare } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { BackButton } from '@/components/navigation/BackButton';
import feedinLogo from '@/assets/feedin-logo.png';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';

interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'voice';
  status: string;
  duration: number;
  credits_deducted: number;
  created_at: string;
  caller: {
    display_name: string | null;
    avatar_url: string | null;
  };
  receiver: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

type TabFilter = 'all' | 'missed' | 'incoming' | 'outgoing';

const TABS: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'missed', label: 'Missed' },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
];

const CallHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadCallHistory();
  }, [user]);

  const loadCallHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey (display_name, avatar_url),
          receiver:profiles!call_logs_receiver_id_fkey (display_name, avatar_url)
        `)
        .or(`caller_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setCallLogs((data as CallLog[]) || []);
    } catch (error: any) {
      console.error('Error loading call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = callLogs.filter((log) => {
    if (activeTab === 'all') return true;
    const isOutgoing = log.caller_id === user?.id;
    if (activeTab === 'missed') return log.status === 'missed' || (log.status === 'ended' && !log.duration && !isOutgoing);
    if (activeTab === 'incoming') return !isOutgoing;
    if (activeTab === 'outgoing') return isOutgoing;
    return true;
  });

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return 'Not connected';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCallIcon = (log: CallLog) => {
    const isOutgoing = log.caller_id === user?.id;
    const isMissed = log.status === 'missed' || (log.status === 'ended' && !log.duration && !isOutgoing);
    if (isMissed) return <PhoneMissed className="w-4 h-4 text-destructive" />;
    if (log.call_type === 'video') return <Video className="w-4 h-4 text-primary" />;
    if (isOutgoing) return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
    return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  };

  const getOtherUser = (log: CallLog) => log.caller_id === user?.id ? log.receiver : log.caller;
  const getOtherUserId = (log: CallLog) => log.caller_id === user?.id ? log.receiver_id : log.caller_id;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BackButton fallback="/messages" className="text-muted-foreground hover:text-foreground" />
              <img src={feedinLogo} alt="FEEDIN" className="w-8 h-8" />
              <span className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">Calls</span>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
              {tab.key === 'missed' && callLogs.filter(l => l.status === 'missed' || (l.status === 'ended' && !l.duration && l.receiver_id === user?.id)).length > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1 rounded-full">
                  {callLogs.filter(l => l.status === 'missed' || (l.status === 'ended' && !l.duration && l.receiver_id === user?.id)).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="container mx-auto px-4 py-3 max-w-2xl">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <Phone className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {activeTab === 'missed' ? 'No missed calls' : activeTab === 'incoming' ? 'No incoming calls' : activeTab === 'outgoing' ? 'No outgoing calls' : 'No call history'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => {
              const otherUser = getOtherUser(log);
              const otherUserId = getOtherUserId(log);
              const isMissed = log.status === 'missed' || (log.status === 'ended' && !log.duration && log.receiver_id === user?.id);
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-2.5 p-2.5 bg-card rounded-xl hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{otherUser.display_name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {getCallIcon(log)}
                      <p className={cn("text-sm font-medium truncate", isMissed && "text-destructive")}>
                        {otherUser.display_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span>{formatDate(log.created_at)}</span>
                      <span>·</span>
                      <span>{formatDuration(log.duration)}</span>
                      {log.credits_deducted > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex items-center text-amber-500">
                            <Coins className="w-3 h-3 mr-0.5" />
                            {log.credits_deducted}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => navigate(`/messages?userId=${otherUserId}`)}
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => navigate(`/messages?userId=${otherUserId}`)}
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-primary hover:text-primary/80"
                    >
                      {log.call_type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CallHistory;
