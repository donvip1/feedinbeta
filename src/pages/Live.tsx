import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/navigation/BottomNav';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ArrowLeft, Radio, Users, Eye } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

interface LiveStream {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_live: boolean;
  viewers_count: number;
  created_at: string;
  streamer: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Live = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadLiveStreams();
  }, [user]);

  const loadLiveStreams = async () => {
    try {
      // For now, we'll show a coming soon page
      // In production, this would fetch real live streams
      setLiveStreams([]);
    } catch (error: any) {
      console.error('Error loading live streams:', error);
      toast({
        title: 'Error loading live streams',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const startLiveStream = () => {
    toast({
      title: 'Coming Soon',
      description: 'Live streaming will be available soon!',
    });
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-lg border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate('/feed')}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <img src={feedinLogo} alt="FEEDIN" className="w-10 h-10" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Live
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <NotificationBell />
              <Button
                onClick={startLiveStream}
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                <Radio className="w-4 h-4 mr-2" />
                Go Live
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
                <Skeleton className="w-full aspect-video" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : liveStreams.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative bg-gradient-to-br from-red-600 to-pink-600 rounded-full p-6">
                <Radio className="w-16 h-16 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">Live Streaming Coming Soon!</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Share your moments in real-time with your followers. Live streaming features are being developed.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <Radio className="w-8 h-8 text-red-500 mb-3" />
                <h3 className="font-semibold mb-2">Go Live Instantly</h3>
                <p className="text-sm text-gray-400">
                  Start broadcasting to your followers with one tap
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <Users className="w-8 h-8 text-blue-500 mb-3" />
                <h3 className="font-semibold mb-2">Real-time Interaction</h3>
                <p className="text-sm text-gray-400">
                  Engage with viewers through live comments and reactions
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <Eye className="w-8 h-8 text-purple-500 mb-3" />
                <h3 className="font-semibold mb-2">Track Viewers</h3>
                <p className="text-sm text-gray-400">
                  See who's watching and how many people join
                </p>
              </div>
            </div>
            <Button
              onClick={startLiveStream}
              className="mt-8 bg-red-600 hover:bg-red-700"
              size="lg"
            >
              <Radio className="w-5 h-5 mr-2" />
              Notify Me When Ready
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveStreams.map((stream) => (
              <div
                key={stream.id}
                className="bg-gray-900 rounded-lg overflow-hidden cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/live/${stream.id}`)}
              >
                <div className="relative aspect-video bg-gray-800">
                  {stream.thumbnail_url ? (
                    <img
                      src={stream.thumbnail_url}
                      alt={stream.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Radio className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  {stream.is_live && (
                    <Badge className="absolute top-2 left-2 bg-red-600 hover:bg-red-700">
                      <Radio className="w-3 h-3 mr-1 animate-pulse" />
                      LIVE
                    </Badge>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    {stream.viewers_count}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={stream.streamer.avatar_url || ''} />
                      <AvatarFallback>
                        {stream.streamer.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{stream.title}</h3>
                      <p className="text-sm text-gray-400 truncate">
                        {stream.streamer.display_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Live;