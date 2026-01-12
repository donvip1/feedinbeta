import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
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
  Crown, Ban, Eye
} from 'lucide-react';
import { BottomNav } from '@/components/navigation/BottomNav';

const AdminPanel = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permissions, isLoading: permissionsLoading } = useAdminRole();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

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

  // Fetch admin users
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
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {permissions.canManageP2P && (
              <TabsTrigger value="p2p" className="gap-1">
                <ShoppingCart className="w-4 h-4" /> P2P
              </TabsTrigger>
            )}
            {permissions.canManageDisputes && (
              <TabsTrigger value="disputes" className="gap-1">
                <Gavel className="w-4 h-4" /> Disputes
              </TabsTrigger>
            )}
            {permissions.canManageRoles && (
              <TabsTrigger value="roles" className="gap-1">
                <Users className="w-4 h-4" /> Roles
              </TabsTrigger>
            )}
            {(permissions.isAdmin || permissions.isDeveloper) && (
              <TabsTrigger value="logs" className="gap-1">
                <History className="w-4 h-4" /> Logs
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
                        {admin.assigner && (
                          <p className="text-xs text-muted-foreground">
                            Added by @{admin.assigner.username}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
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

export default AdminPanel;
