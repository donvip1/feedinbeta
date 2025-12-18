import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { 
  ArrowLeft, DollarSign, Users, Clock, CheckCircle, XCircle, 
  Search, Calendar, TrendingUp, Wallet, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

interface MonetizedCreator {
  id: string;
  user_id: string;
  is_monetized: boolean;
  monetized_at: string | null;
  total_earnings: number;
  total_withdrawn: number;
  last_payout_at: string | null;
}

interface PayoutStats {
  total_monetized_creators: number;
  pending_requests: number;
  total_paid_out: number;
  total_pending_amount: number;
  this_month_payouts: number;
}

export default function CreatorPayouts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);
  const [actionNotes, setActionNotes] = useState('');

  // Check admin access
  const { data: canAccess, isLoading: accessLoading } = useQuery({
    queryKey: ['can-view-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_view_admin_wallet');
      if (error) throw error;
      return data;
    },
  });

  // Fetch payout statistics
  const { data: stats } = useQuery({
    queryKey: ['payout-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_payout_statistics');
      if (error) throw error;
      return data as unknown as PayoutStats;
    },
    enabled: canAccess === true,
  });

  // Fetch pending payout requests
  const { data: pendingRequests } = useQuery({
    queryKey: ['pending-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_payout_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return data as PayoutRequest[];
    },
    enabled: canAccess === true,
  });

  // Fetch all payout requests
  const { data: allRequests } = useQuery({
    queryKey: ['all-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_payout_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as PayoutRequest[];
    },
    enabled: canAccess === true,
  });

  // Fetch monetized creators
  const { data: monetizedCreators } = useQuery({
    queryKey: ['monetized-creators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_monetization')
        .select('*')
        .order('total_earnings', { ascending: false });
      if (error) throw error;
      return data as MonetizedCreator[];
    },
    enabled: canAccess === true,
  });

  // Fetch profiles for display
  const { data: profiles } = useQuery({
    queryKey: ['payout-profiles', pendingRequests, monetizedCreators],
    queryFn: async () => {
      const userIds = new Set<string>();
      pendingRequests?.forEach(r => userIds.add(r.user_id));
      monetizedCreators?.forEach(c => userIds.add(c.user_id));
      
      if (userIds.size === 0) return {};

      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', Array.from(userIds));
      
      if (error) throw error;
      
      const profileMap: Record<string, any> = {};
      data?.forEach(p => { profileMap[p.id] = p; });
      return profileMap;
    },
    enabled: canAccess === true && (!!pendingRequests || !!monetizedCreators),
  });

  // Process payout mutation
  const processPayout = useMutation({
    mutationFn: async ({ requestId, action, notes }: { requestId: string; action: string; notes: string }) => {
      const { data, error } = await supabase.rpc('process_payout_request', {
        p_request_id: requestId,
        p_action: action,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['pending-payouts'] });
        queryClient.invalidateQueries({ queryKey: ['all-payouts'] });
        queryClient.invalidateQueries({ queryKey: ['payout-stats'] });
        queryClient.invalidateQueries({ queryKey: ['monetized-creators'] });
        setSelectedRequest(null);
        setActionNotes('');
      } else {
        toast.error(data?.error || 'Failed to process payout');
      }
    },
    onError: () => {
      toast.error('Failed to process payout');
    },
  });

  // Toggle monetization mutation
  const toggleMonetization = useMutation({
    mutationFn: async ({ userId, monetize }: { userId: string; monetize: boolean }) => {
      const { data, error } = await supabase.rpc('toggle_creator_monetization', {
        p_user_id: userId,
        p_monetize: monetize,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast.success('Monetization status updated');
        queryClient.invalidateQueries({ queryKey: ['monetized-creators'] });
        queryClient.invalidateQueries({ queryKey: ['payout-stats'] });
      }
    },
  });

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-center mb-4">
          You don't have permission to access this page.
        </p>
        <Button onClick={() => navigate('/settings')}>Back to Settings</Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Creator Payouts</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Monetized</span>
              </div>
              <p className="text-2xl font-bold">{stats?.total_monetized_creators || 0}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Pending</span>
              </div>
              <p className="text-2xl font-bold text-yellow-500">{stats?.pending_requests || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Total Paid</span>
              </div>
              <p className="text-2xl font-bold text-green-500">{(stats?.total_paid_out || 0).toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">This Month</span>
              </div>
              <p className="text-2xl font-bold">{(stats?.this_month_payouts || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payout Schedule Info */}
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Payout Schedule
            </h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• <strong>Regular creators:</strong> 30th of each month (28th for February)</p>
              <p>• <strong>Pro/Premium subscribers:</strong> Every 10 days (up to 3x per month)</p>
              <p>• <strong>Minimum payout:</strong> 100 credits</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingRequests?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="creators">Creators</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Pending Requests */}
          <TabsContent value="pending" className="space-y-3 mt-4">
            {pendingRequests && pendingRequests.length > 0 ? (
              pendingRequests.map((request) => {
                const profile = profiles?.[request.user_id];
                return (
                  <Card key={request.id} className="bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{profile?.display_name || profile?.username || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{request.amount.toLocaleString()} credits</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.requested_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>

                      {selectedRequest?.id === request.id ? (
                        <div className="mt-4 space-y-3">
                          <Input
                            placeholder="Add notes (optional)"
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              onClick={() => processPayout.mutate({ 
                                requestId: request.id, 
                                action: 'approve', 
                                notes: actionNotes 
                              })}
                              disabled={processPayout.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              className="flex-1"
                              onClick={() => processPayout.mutate({ 
                                requestId: request.id, 
                                action: 'reject', 
                                notes: actionNotes 
                              })}
                              disabled={processPayout.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(null);
                                setActionNotes('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full mt-3"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Process Request
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No pending payout requests</p>
              </div>
            )}
          </TabsContent>

          {/* Monetized Creators */}
          <TabsContent value="creators" className="space-y-3 mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {monetizedCreators && monetizedCreators.length > 0 ? (
              monetizedCreators
                .filter(creator => {
                  if (!searchTerm) return true;
                  const profile = profiles?.[creator.user_id];
                  return profile?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
                })
                .map((creator) => {
                  const profile = profiles?.[creator.user_id];
                  return (
                    <Card key={creator.id} className="bg-card/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={profile?.avatar_url} />
                              <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{profile?.display_name || profile?.username || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">@{profile?.username}</p>
                            </div>
                          </div>
                          <Badge variant={creator.is_monetized ? 'default' : 'secondary'}>
                            {creator.is_monetized ? 'Monetized' : 'Disabled'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Earnings</p>
                            <p className="font-semibold text-green-500">{creator.total_earnings.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Withdrawn</p>
                            <p className="font-semibold">{creator.total_withdrawn.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Available</p>
                            <p className="font-semibold text-primary">
                              {(creator.total_earnings - creator.total_withdrawn).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {creator.last_payout_at && (
                          <p className="text-xs text-muted-foreground mt-3">
                            Last payout: {format(new Date(creator.last_payout_at), 'MMM dd, yyyy')}
                          </p>
                        )}

                        <Button
                          variant={creator.is_monetized ? 'destructive' : 'default'}
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => toggleMonetization.mutate({ 
                            userId: creator.user_id, 
                            monetize: !creator.is_monetized 
                          })}
                        >
                          {creator.is_monetized ? 'Disable Monetization' : 'Enable Monetization'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No monetized creators yet</p>
              </div>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-3 mt-4">
            {allRequests && allRequests.length > 0 ? (
              allRequests.map((request) => {
                const profile = profiles?.[request.user_id];
                return (
                  <Card key={request.id} className="bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.avatar_url} />
                            <AvatarFallback>{profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">@{profile?.username || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.requested_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{request.amount.toLocaleString()}</p>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      {request.rejection_reason && (
                        <p className="text-xs text-red-500 mt-2">
                          Reason: {request.rejection_reason}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No payout history</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
