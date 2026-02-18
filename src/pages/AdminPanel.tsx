import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, Shield, Users, Gavel, ShoppingCart, History, 
  Search, X, Check, AlertTriangle, RefreshCw, UserPlus,
  Crown, Ban, Eye, Radio, StopCircle, CreditCard, UserMinus
} from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

const AdminPanel = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, isLoading: permissionsLoading } = useAdminRole();
  const { user } = useAuth();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [endingLive, setEndingLive] = useState(false);
  const [demoting, setDemoting] = useState<string | null>(null);

  // Fetch active live spaces and streams
  const { data: activeSpaces, refetch: refetchSpaces } = useQuery({
    queryKey: ['admin-active-spaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_spaces')
        .select('id, title, host_id, status, created_at, viewer_count')
        .eq('status', 'live');
      if (error) throw error;
      return data || [];
    },
    enabled: permissions.isAdmin || permissions.isDeveloper,
  });

  const { data: activeStreams, refetch: refetchStreams } = useQuery({
    queryKey: ['admin-active-streams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_streams')
        .select('id, title, host_id, status, created_at, viewer_count')
        .eq('status', 'live');
      if (error) throw error;
      return data || [];
    },
    enabled: permissions.isAdmin || permissions.isDeveloper,
  });

  const handleEndAllLive = async () => {
    setEndingLive(true);
    try {
      const [spacesRes, streamsRes] = await Promise.all([
        supabase.from('live_spaces').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('status', 'live'),
        supabase.from('live_streams').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('status', 'live'),
      ]);
      if (spacesRes.error) throw spacesRes.error;
      if (streamsRes.error) throw streamsRes.error;
      toast.success('All live streams and spaces ended');
      refetchSpaces();
      refetchStreams();
    } catch (error: any) {
      toast.error(error.message || 'Failed to end all');
    } finally {
      setEndingLive(false);
    }
  };

  const handleEndSingle = async (type: 'space' | 'stream', id: string) => {
    try {
      const table = type === 'space' ? 'live_spaces' : 'live_streams';
      const { error } = await supabase.from(table).update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success(`${type === 'space' ? 'Space' : 'Stream'} ended`);
      type === 'space' ? refetchSpaces() : refetchStreams();
    } catch (error: any) {
      toast.error(error.message || 'Failed to end');
    }
  };

  // Fetch pending P2P orders
  const { data: pendingOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['admin-pending-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_pending_p2p_orders', limit: 100 },
      });
      if (error) throw error;
      return data.orders || [];
    },
    enabled: permissions.canManageP2P,
  });

  // Fetch disputes
  const { data: disputes, isLoading: disputesLoading, refetch: refetchDisputes } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_disputes', status: 'open', limit: 50 },
      });
      if (error) throw error;
      return data.disputes || [];
    },
    enabled: permissions.canManageDisputes,
  });

  // Fetch admin users (for roles tab)
  const { data: adminUsers, refetch: refetchAdminUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_admin_users' },
      });
      if (error) throw error;
      return data.users || [];
    },
    enabled: permissions.canManageRoles,
  });

  // Fetch team members (all admins/moderators - visible to any admin)
  const { data: teamMembers } = useQuery({
    queryKey: ['admin-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at, assigned_by')
        .in('role', ['super_admin', 'developer', 'admin', 'moderator'])
        .order('role');
      if (error) throw error;
      
      if (!data || data.length === 0) return [];
      
      // Fetch profiles for all team members
      const userIds = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      
      // Fetch assigner profiles
      const assignerIds = data.filter(r => r.assigned_by).map(r => r.assigned_by!);
      let assignerProfiles: any[] = [];
      if (assignerIds.length > 0) {
        const { data: assigners } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', assignerIds);
        assignerProfiles = assigners || [];
      }
      
      return data.map(role => ({
        ...role,
        profile: profiles?.find(p => p.id === role.user_id),
        assigner: assignerProfiles.find(p => p.id === role.assigned_by),
      }));
    },
    enabled: permissions.isAdmin || permissions.isDeveloper,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const handleDemoteUser = async (targetUserId: string, username: string) => {
    setDemoting(targetUserId);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'revoke_role', targetUserId },
      });
      if (error) throw error;
      toast.success(`@${username} has been demoted to normal user`);
      refetchAdminUsers();
      queryClient.invalidateQueries({ queryKey: ['admin-team-members'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to demote user');
    } finally {
      setDemoting(null);
    }
  };

  // Fetch action logs
  const { data: actionLogs } = useQuery({
    queryKey: ['admin-action-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_action_logs', limit: 50 },
      });
      if (error) throw error;
      return data.logs || [];
    },
    enabled: permissions.isAdmin || permissions.isDeveloper,
  });

  const handleCancelOrder = async (transactionId: string) => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'cancel_p2p_order', transactionId, reason: cancelReason },
      });
      if (error) throw error;
      toast.success('Order cancelled');
      refetchOrders();
      setCancelReason('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrders.length === 0) {
      toast.error('Select orders to cancel');
      return;
    }
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'bulk_cancel_p2p_orders', transactionIds: selectedOrders, reason: cancelReason },
      });
      if (error) throw error;
      toast.success(`Cancelled ${data.cancelled} orders, ${data.failed} failed`);
      refetchOrders();
      setSelectedOrders([]);
      setCancelReason('');
    } catch (error: any) {
      toast.error(error.message || 'Bulk cancel failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleAssignDispute = async (disputeId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'assign_dispute', disputeId },
      });
      if (error) throw error;
      toast.success('Dispute assigned to you');
      refetchDisputes();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign');
    } finally {
      setProcessing(false);
    }
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrders(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!permissions.hasAnyAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have admin permissions</p>
          <Button onClick={() => navigate('/feed')}>Go to Feed</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Admin Panel
                </h1>
                <p className="text-xs text-muted-foreground">
                  Role: <Badge variant="outline" className="ml-1">{permissions.role}</Badge>
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue={permissions.canManageP2P ? "p2p" : permissions.canManageDisputes ? "disputes" : "roles"}>
          <TabsList className="grid w-full grid-cols-7 mb-6">
            {permissions.canManageP2P && (
              <TabsTrigger value="p2p" className="gap-1 text-xs">
                <ShoppingCart className="w-3 h-3" /> P2P
              </TabsTrigger>
            )}
            {permissions.canManageDisputes && (
              <TabsTrigger value="disputes" className="gap-1 text-xs">
                <Gavel className="w-3 h-3" /> Disputes
              </TabsTrigger>
            )}
            {permissions.canManageRoles && (
              <TabsTrigger value="roles" className="gap-1 text-xs">
                <Users className="w-3 h-3" /> Roles
              </TabsTrigger>
            )}
            {(permissions.isAdmin || permissions.isDeveloper) && (
              <TabsTrigger value="subscriptions" className="gap-1 text-xs">
                <CreditCard className="w-3 h-3" /> Plans
              </TabsTrigger>
            )}
            {(permissions.isAdmin || permissions.isDeveloper) && (
              <TabsTrigger value="live" className="gap-1 text-xs">
                <Radio className="w-3 h-3" /> Live
              </TabsTrigger>
            )}
            {(permissions.isAdmin || permissions.isDeveloper) && (
              <TabsTrigger value="logs" className="gap-1 text-xs">
                <History className="w-3 h-3" /> Logs
              </TabsTrigger>
            )}
            {(permissions.isAdmin || permissions.isDeveloper) && (
              <TabsTrigger value="team" className="gap-1 text-xs">
                <Shield className="w-3 h-3" /> Team
              </TabsTrigger>
            )}
          </TabsList>

          {/* P2P Orders Tab */}
          {permissions.canManageP2P && (
            <TabsContent value="p2p" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending P2P Orders</CardTitle>
                  <CardDescription>Cancel orders individually or in bulk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search and bulk actions */}
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search by username..." 
                          value={searchUsername}
                          onChange={(e) => setSearchUsername(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => refetchOrders()}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedOrders.length > 0 && (
                    <div className="p-3 bg-destructive/10 rounded-lg flex items-center justify-between">
                      <span className="text-sm">{selectedOrders.length} orders selected</span>
                      <div className="flex gap-2">
                        <Textarea 
                          placeholder="Reason for bulk cancel..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="h-10 min-h-0 w-48"
                        />
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={handleBulkCancel}
                          disabled={processing}
                        >
                          Bulk Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {ordersLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : pendingOrders?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending orders
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {pendingOrders?.filter((order: any) => {
                        if (!searchUsername) return true;
                        const buyerName = order.buyer?.username?.toLowerCase() || '';
                        const sellerName = order.seller?.username?.toLowerCase() || '';
                        return buyerName.includes(searchUsername.toLowerCase()) || 
                               sellerName.includes(searchUsername.toLowerCase());
                      }).map((order: any) => (
                        <div 
                          key={order.id} 
                          className="p-3 border rounded-lg flex items-center gap-3"
                        >
                          <Checkbox 
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={order.status === 'pending' ? 'secondary' : 'default'}>
                                {order.status}
                              </Badge>
                              <span className="font-medium">{order.credits_amount} credits</span>
                              <span className="text-muted-foreground">• ${order.price_usd}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span>Buyer: @{order.buyer?.username}</span>
                              <span className="mx-2">→</span>
                              <span>Seller: @{order.seller?.username}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <X className="w-4 h-4 mr-1" /> Cancel
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cancel Order</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Cancel order for {order.credits_amount} credits between @{order.buyer?.username} and @{order.seller?.username}?
                                </p>
                                <Textarea 
                                  placeholder="Reason for cancellation..."
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                />
                              </div>
                              <DialogFooter>
                                <Button 
                                  variant="destructive"
                                  onClick={() => handleCancelOrder(order.id)}
                                  disabled={processing}
                                >
                                  Confirm Cancel
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Disputes Tab */}
          {permissions.canManageDisputes && (
            <TabsContent value="disputes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Open Disputes</CardTitle>
                  <CardDescription>Review and resolve P2P disputes</CardDescription>
                </CardHeader>
                <CardContent>
                  {disputesLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    </div>
                  ) : disputes?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gavel className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No open disputes
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {disputes?.map((dispute: any) => (
                        <Card key={dispute.id} className="border-destructive/30">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="w-4 h-4 text-destructive" />
                                  <span className="font-medium">{dispute.reason}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {dispute.description}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <span>Initiated by: @{dispute.initiator?.username}</span>
                                  <span className="mx-2">•</span>
                                  <span>{dispute.transaction?.credits_amount} credits (${dispute.transaction?.price_usd})</span>
                                </div>
                                {dispute.moderator && (
                                  <p className="text-xs text-primary mt-1">
                                    Assigned to: @{dispute.moderator.username}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                {!dispute.moderator && (
                                  <Button 
                                    size="sm"
                                    onClick={() => handleAssignDispute(dispute.id)}
                                    disabled={processing}
                                  >
                                    Assign to Me
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => navigate(`/wallet/p2p/${dispute.transaction_id}`)}
                                >
                                  <Eye className="w-4 h-4 mr-1" /> View
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Roles Tab */}
          {permissions.canManageRoles && (
            <TabsContent value="roles" className="space-y-4">
              <AssignRoleCard onSuccess={refetchAdminUsers} />
              
              <Card>
                <CardHeader>
                  <CardTitle>Admin Users</CardTitle>
                  <CardDescription>Manage team members and their permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                     {adminUsers?.map((admin: any) => (
                      <div key={admin.id} className="p-3 border rounded-lg flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={admin.user?.avatar_url} />
                          <AvatarFallback>{admin.user?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{admin.user?.display_name}</span>
                            <Badge variant={admin.role === 'developer' ? 'default' : admin.role === 'admin' ? 'secondary' : 'outline'}>
                              {admin.role === 'developer' && <Crown className="w-3 h-3 mr-1" />}
                              {admin.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">@{admin.user?.username}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {admin.can_manage_p2p && <Badge variant="outline" className="text-xs">P2P</Badge>}
                            {admin.can_manage_disputes && <Badge variant="outline" className="text-xs">Disputes</Badge>}
                            {admin.can_manage_users && <Badge variant="outline" className="text-xs">Users</Badge>}
                            {admin.can_manage_content && <Badge variant="outline" className="text-xs">Content</Badge>}
                            {admin.can_view_analytics && <Badge variant="outline" className="text-xs">Analytics</Badge>}
                            {admin.can_manage_roles && <Badge variant="outline" className="text-xs">Roles</Badge>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {admin.assigner && (
                            <p className="text-xs text-muted-foreground">
                              Added by @{admin.assigner.username}
                            </p>
                          )}
                          {/* Demote button - only show if: not super_admin target, and current user has permission */}
                          {admin.role !== 'super_admin' && admin.user_id !== user?.id && (
                            (permissions.isDeveloper || (permissions.isAdmin && admin.role !== 'developer'))
                          ) && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                                  <UserMinus className="w-3 h-3 mr-1" /> Demote
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Demote @{admin.user?.username}?</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  This will remove their <strong>{admin.role}</strong> role and make them a normal user. They will lose all admin permissions.
                                </p>
                                <DialogFooter>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleDemoteUser(admin.user_id, admin.user?.username)}
                                    disabled={demoting === admin.user_id}
                                  >
                                    {demoting === admin.user_id ? (
                                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <UserMinus className="w-4 h-4 mr-2" />
                                    )}
                                    Confirm Demote
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Subscriptions Tab */}
          {(permissions.isAdmin || permissions.isDeveloper) && (
            <TabsContent value="subscriptions" className="space-y-4">
              <ManageSubscriptionCard />
            </TabsContent>
          )}

          {/* Live Management Tab */}
          {(permissions.isAdmin || permissions.isDeveloper) && (
            <TabsContent value="live" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-red-500" />
                    Live Stream & Space Management
                  </CardTitle>
                  <CardDescription>
                    Monitor and control all active live sessions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* End All Button */}
                  <div className="flex items-center justify-between p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">End All Live Sessions</p>
                      <p className="text-xs text-muted-foreground">
                        Immediately end all active streams and spaces
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={endingLive}>
                          <StopCircle className="w-4 h-4 mr-2" />
                          End All
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            End All Live Sessions?
                          </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          This will immediately end <strong>{(activeSpaces?.length || 0) + (activeStreams?.length || 0)}</strong> active sessions. 
                          All participants will be disconnected. This action cannot be undone.
                        </p>
                        <DialogFooter>
                          <Button variant="destructive" onClick={handleEndAllLive} disabled={endingLive}>
                            {endingLive ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <StopCircle className="w-4 h-4 mr-2" />}
                            Confirm End All
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Active Spaces */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      Active Spaces
                      <Badge variant="secondary">{activeSpaces?.length || 0}</Badge>
                    </h3>
                    {activeSpaces && activeSpaces.length > 0 ? (
                      <div className="space-y-2">
                        {activeSpaces.map((space: any) => (
                          <div key={space.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{space.title || 'Untitled Space'}</p>
                              <p className="text-xs text-muted-foreground">
                                {space.viewer_count || 0} viewers · Started {formatDistanceToNow(new Date(space.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => handleEndSingle('space', space.id)}>
                              <StopCircle className="w-3 h-3 mr-1" /> End
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active spaces</p>
                    )}
                  </div>

                  {/* Active Streams */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      Active Streams
                      <Badge variant="secondary">{activeStreams?.length || 0}</Badge>
                    </h3>
                    {activeStreams && activeStreams.length > 0 ? (
                      <div className="space-y-2">
                        {activeStreams.map((stream: any) => (
                          <div key={stream.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium text-sm">{stream.title || 'Untitled Stream'}</p>
                              <p className="text-xs text-muted-foreground">
                                {stream.viewer_count || 0} viewers · Started {formatDistanceToNow(new Date(stream.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => handleEndSingle('stream', stream.id)}>
                              <StopCircle className="w-3 h-3 mr-1" /> End
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active streams</p>
                    )}
                  </div>

                  {/* Refresh */}
                  <Button variant="outline" size="sm" onClick={() => { refetchSpaces(); refetchStreams(); }}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Logs Tab */}
          {(permissions.isAdmin || permissions.isDeveloper) && (
            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Action Logs</CardTitle>
                  <CardDescription>Audit trail of admin actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {actionLogs?.map((log: any) => (
                      <div key={log.id} className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{log.action_type}</Badge>
                          <span className="text-muted-foreground">by @{log.admin?.username}</span>
                        </div>
                        <p className="text-muted-foreground">
                          Target: {log.target_type} {log.target_username && `(@${log.target_username})`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), 'PPp')}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Team Overview Tab */}
          {(permissions.isAdmin || permissions.isDeveloper) && (
            <TabsContent value="team" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Team Overview
                  </CardTitle>
                  <CardDescription>
                    All administrators and moderators on the platform ({teamMembers?.length || 0} members)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!teamMembers || teamMembers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      No team members found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Group by role */}
                      {(['super_admin', 'developer', 'admin', 'moderator'] as const).map(roleType => {
                        const members = teamMembers.filter((m: any) => m.role === roleType);
                        if (members.length === 0) return null;
                        
                        const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
                          super_admin: { label: 'CEO / Super Admin', icon: <Crown className="w-4 h-4" />, color: 'text-yellow-500' },
                          developer: { label: 'Developers', icon: <Shield className="w-4 h-4" />, color: 'text-primary' },
                          admin: { label: 'Administrators', icon: <Shield className="w-4 h-4" />, color: 'text-blue-500' },
                          moderator: { label: 'Moderators', icon: <Users className="w-4 h-4" />, color: 'text-green-500' },
                        };
                        
                        const roleInfo = roleLabels[roleType];
                        
                        return (
                          <div key={roleType}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={roleInfo.color}>{roleInfo.icon}</span>
                              <h3 className="font-semibold text-sm">{roleInfo.label}</h3>
                              <Badge variant="secondary" className="text-xs">{members.length}</Badge>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {members.map((member: any) => (
                                <Card key={member.user_id} className="border border-border/50">
                                  <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10">
                                        <AvatarImage src={member.profile?.avatar_url} />
                                        <AvatarFallback>
                                          {member.profile?.display_name?.[0] || 'U'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">
                                          {member.profile?.display_name || 'Unknown'}
                                        </p>
                                        <p className="text-sm text-muted-foreground truncate">
                                          @{member.profile?.username || 'unknown'}
                                        </p>
                                      </div>
                                      <Badge 
                                        variant={roleType === 'super_admin' || roleType === 'developer' ? 'default' : 'outline'}
                                        className="text-xs shrink-0"
                                      >
                                        {roleType === 'super_admin' ? 'CEO' : roleType}
                                      </Badge>
                                    </div>
                                    {member.assigner && (
                                      <p className="text-xs text-muted-foreground mt-2">
                                        Added by @{member.assigner.display_name || member.assigner.username}
                                        {member.created_at && ` • ${formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}`}
                                      </p>
                                    )}
                                    {/* Demote button in team view */}
                                    {member.role !== 'super_admin' && member.user_id !== user?.id && (
                                      (permissions.isDeveloper || (permissions.isAdmin && member.role !== 'developer'))
                                    ) && permissions.canManageRoles && (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="outline" size="sm" className="mt-2 w-full text-destructive border-destructive/30 hover:bg-destructive/10">
                                            <UserMinus className="w-3 h-3 mr-1" /> Demote to User
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle>Demote @{member.profile?.username}?</DialogTitle>
                                          </DialogHeader>
                                          <p className="text-sm text-muted-foreground">
                                            This will remove their <strong>{member.role}</strong> role and make them a normal user.
                                          </p>
                                          <DialogFooter>
                                            <Button 
                                              variant="destructive" 
                                              onClick={() => handleDemoteUser(member.user_id, member.profile?.username)}
                                              disabled={demoting === member.user_id}
                                            >
                                              {demoting === member.user_id ? (
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                              ) : (
                                                <UserMinus className="w-4 h-4 mr-2" />
                                              )}
                                              Confirm Demote
                                            </Button>
                                          </DialogFooter>
                                        </DialogContent>
                                      </Dialog>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

// Separate component for assigning roles
const AssignRoleCard = ({ onSuccess }: { onSuccess: () => void }) => {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [role, setRole] = useState('moderator');
  const [permissions, setPermissions] = useState({
    canManageP2P: false,
    canManageDisputes: true,
    canManageUsers: false,
    canManageContent: true,
    canViewAnalytics: true,
    canManageRoles: false,
  });
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const { permissions: adminPerms } = useAdminRole();

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'search_user', username: searchUsername },
    });
    
    if (!error && data.users) {
      setSearchResults(data.users);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'assign_role', 
          targetUserId: selectedUser.id,
          role,
          permissions,
          notes,
        },
      });
      if (error) throw error;
      toast.success(`Role assigned to @${selectedUser.username}`);
      setSelectedUser(null);
      setSearchUsername('');
      setSearchResults([]);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign role');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Assign Role
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Search username..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div 
                key={user.id}
                className="p-2 border rounded-lg flex items-center gap-2 cursor-pointer hover:bg-muted"
                onClick={() => setSelectedUser(user)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback>{selectedUser.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.display_name}</p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                {adminPerms.isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <p className="text-sm font-medium">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'canManageP2P', label: 'Manage P2P' },
                  { key: 'canManageDisputes', label: 'Manage Disputes' },
                  { key: 'canManageUsers', label: 'Manage Users' },
                  { key: 'canManageContent', label: 'Manage Content' },
                  { key: 'canViewAnalytics', label: 'View Analytics' },
                  { key: 'canManageRoles', label: 'Manage Roles' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox 
                      checked={permissions[key as keyof typeof permissions]}
                      onCheckedChange={(checked) => 
                        setPermissions(prev => ({ ...prev, [key]: checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <Textarea 
              placeholder="Notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <Button onClick={handleAssign} disabled={processing} className="w-full">
              <Check className="w-4 h-4 mr-2" />
              Assign Role
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Subscription management component
const ManageSubscriptionCard = () => {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTier, setSelectedTier] = useState('');
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: tiers } = useQuery({
    queryKey: ['admin-subscription-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    const { data, error } = await supabase.functions.invoke('admin-actions', {
      body: { action: 'search_user', username: searchUsername },
    });
    if (!error && data.users) {
      setSearchResults(data.users);
    }
  };

  const handleSelectUser = async (user: any) => {
    setSelectedUser(user);
    setSearchResults([]);
    setLoadingSub(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'get_user_subscription', targetUserId: user.id },
      });
      if (!error) {
        setCurrentSub(data.subscription);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSub(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedUser || !selectedTier) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { 
          action: 'upgrade_user_plan', 
          targetUserId: selectedUser.id, 
          tierId: selectedTier,
          notes,
        },
      });
      if (error) throw error;
      toast.success(`Upgraded @${selectedUser.username} to ${data.tierName}`);
      // Refresh subscription
      handleSelectUser(selectedUser);
      setNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upgrade plan');
    } finally {
      setProcessing(false);
    }
  };

  const currentTierName = currentSub?.subscription_tiers
    ? (Array.isArray(currentSub.subscription_tiers) ? currentSub.subscription_tiers[0]?.name : currentSub.subscription_tiers?.name)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Manage User Subscriptions
        </CardTitle>
        <CardDescription>Search for a user and upgrade their plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            placeholder="Search username..."
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {searchResults.length > 0 && !selectedUser && (
          <div className="space-y-2">
            {searchResults.map((user) => (
              <div 
                key={user.id}
                className="p-2 border rounded-lg flex items-center gap-2 cursor-pointer hover:bg-muted"
                onClick={() => handleSelectUser(user)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback>{user.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback>{selectedUser.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.display_name}</p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setCurrentSub(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {loadingSub ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Current Plan</p>
                  <p className="text-lg font-bold">
                    {currentTierName ? (
                      <Badge variant="default">{currentTierName}</Badge>
                    ) : (
                      <Badge variant="outline">No active plan (Starter)</Badge>
                    )}
                  </p>
                  {currentSub?.current_period_end && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expires: {format(new Date(currentSub.current_period_end), 'PPp')}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Upgrade to</p>
                  <Select value={selectedTier} onValueChange={setSelectedTier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers?.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          <div className="flex items-center gap-2">
                            <Crown className="w-3 h-3" />
                            {tier.name} - ${tier.price}/{tier.interval}
                            {tier.subscription_credits > 0 && ` (+${tier.subscription_credits} credits)`}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Textarea 
                  placeholder="Notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                <Button 
                  onClick={handleUpgrade} 
                  disabled={processing || !selectedTier} 
                  className="w-full"
                >
                  {processing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4 mr-2" />
                  )}
                  Upgrade Plan
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPanel;
