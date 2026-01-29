import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserAds } from '@/hooks/useUserAds';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  Plus, 
  Rocket, 
  Eye, 
  MousePointerClick,
  Pause,
  Play,
  Trash2,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

const MyAds = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ads, loading, pauseAd, resumeAd, deleteAd } = useUserAds();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const getStatusBadge = (ad: typeof ads[0]) => {
    if (!ad.is_active) {
      return <Badge variant="secondary">Paused</Badge>;
    }
    if (ad.approval_status === 'pending') {
      return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending Review</Badge>;
    }
    if (ad.approval_status === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    // Check if ad has expired
    if (ad.expires_at && new Date(ad.expires_at) < new Date()) {
      return <Badge variant="outline">Completed</Badge>;
    }
    return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Active</Badge>;
  };

  const calculateProgress = (ad: typeof ads[0]) => {
    if (!ad.started_at || !ad.expires_at) return 0;
    const start = new Date(ad.started_at).getTime();
    const end = new Date(ad.expires_at).getTime();
    const now = Date.now();
    const progress = ((now - start) / (end - start)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const activeAds = ads.filter(ad => ad.is_active && ad.approval_status === 'approved');
  const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
  const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">My Ads</span>
              </div>
            </div>
            <Button
              onClick={() => navigate('/ads/builder')}
              className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Ad
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Active</span>
            </div>
            <p className="text-2xl font-bold">{activeAds.length}</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Eye className="w-4 h-4" />
              <span className="text-xs">Impressions</span>
            </div>
            <p className="text-2xl font-bold">{totalImpressions.toLocaleString()}</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-xs">CTR</span>
            </div>
            <p className="text-2xl font-bold">{avgCtr}%</p>
          </Card>
        </div>

        {/* Ads List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : ads.length === 0 ? (
          <Card className="p-8 text-center">
            <Rocket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No ads yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first ad to start reaching more people
            </p>
            <Button
              onClick={() => navigate('/ads/builder')}
              className="bg-gradient-to-r from-pink-500 to-rose-500"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Ad
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {ads.map((ad) => (
              <Card key={ad.id} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  {/* Media Preview */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                    {ad.media_url ? (
                      ad.media_type === 'video' ? (
                        <video
                          src={ad.media_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={ad.media_url}
                          alt="Ad preview"
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Rocket className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Ad Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold truncate">{ad.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {ad.description || 'No description'}
                        </p>
                      </div>
                      {getStatusBadge(ad)}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {(ad.impressions || 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" />
                        {(ad.clicks || 0).toLocaleString()}
                      </span>
                      {ad.expires_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(ad.expires_at), 'MMM d')}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {ad.is_active && ad.approval_status === 'approved' && ad.expires_at && new Date(ad.expires_at) > new Date() && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all"
                            style={{ width: `${calculateProgress(ad)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-border">
                  {ad.is_active ? (
                    <button
                      onClick={() => pauseAd(ad.id)}
                      className="flex-1 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition flex items-center justify-center gap-1"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={() => resumeAd(ad.id)}
                      className="flex-1 py-2.5 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10 transition flex items-center justify-center gap-1"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                  )}
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => deleteAd(ad.id)}
                    className="flex-1 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default MyAds;
