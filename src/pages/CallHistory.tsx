import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Coins } from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';
import { BackButton } from '@/components/navigation/BackButton';
import feedinLogo from '@/assets/feedin-logo.png';
import { NotificationBell } from '@/components/notifications/NotificationBell';

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

const CallHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadCallHistory();
  }, [user]);

  const loadCallHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          caller:profiles!call_logs_caller_id_fkey (
            display_name,
            avatar_url
          ),
          receiver:profiles!call_logs_receiver_id_fkey (
            display_name,
            avatar_url
          )
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

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return 'Not connected';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatCredits = (credits: number) => {
    if (!credits || credits === 0) return null;
    return `${credits} credits`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getCallIcon = (log: CallLog) => {
    const isOutgoing = log.caller_id === user?.id;
    const isMissed = log.status === 'missed';
    const isVideo = log.call_type === 'video';

    if (isMissed) {
      return <PhoneMissed className="w-5 h-5 text-red-500" />;
    }
    if (isVideo) {
      return <Video className="w-5 h-5 text-primary" />;
    }
    if (isOutgoing) {
      return <PhoneOutgoing className="w-5 h-5 text-green-500" />;
    }
    return <PhoneIncoming className="w-5 h-5 text-blue-500" />;
  };

  const getOtherUser = (log: CallLog) => {
    return log.caller_id === user?.id ? log.receiver : log.caller;
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BackButton fallback="/messages" className="text-gray-400 hover:text-white" />
              <img src={feedinLogo} alt="FEEDIN" className="w-10 h-10" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Call History
              </span>
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Call History List */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : callLogs.length === 0 ? (
          <div className="text-center py-12">
            <Phone className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400 mb-2">No call history</p>
            <p className="text-sm text-gray-500">Your calls will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {callLogs.map((log) => {
              const otherUser = getOtherUser(log);
              return (
                <div
                  key={log.id}
                  className="flex items-center space-x-3 p-4 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={otherUser.avatar_url || ''} />
                    <AvatarFallback>
                      {otherUser.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      {getCallIcon(log)}
                      <p className="font-semibold truncate">
                        {otherUser.display_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-gray-400">
                      <span>{formatDate(log.created_at)}</span>
                      <span>•</span>
                      <span>{formatDuration(log.duration)}</span>
                      {log.credits_deducted > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center text-amber-400">
                            <Coins className="w-3 h-3 mr-0.5" />
                            {formatCredits(log.credits_deducted)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      // Initiate new call to this user
                      navigate(`/messages`);
                    }}
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:text-primary/90"
                  >
                    {log.call_type === 'video' ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                  </Button>
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