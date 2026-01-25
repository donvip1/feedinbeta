import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Flag, Eye, Check, X, UserX, Ban, Unlock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BannedUser {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  ban_type: string;
  expires_at: string | null;
  created_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Moderation = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banType, setBanType] = useState<"temporary" | "permanent">("temporary");
  const [banDuration, setBanDuration] = useState("7");

  // Check if user has moderator/admin role
  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["moderator", "admin"])
        .single();
      
      if (error) return null;
      return data?.role;
    },
  });

  const { data: pendingReports, refetch: refetchReports } = useQuery({
    queryKey: ["pending-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_reports")
        .select(`
          *,
          profiles!reporter_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole,
  });

  const { data: contentFlags } = useQuery({
    queryKey: ["content-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_flags")
        .select("*")
        .eq("reviewed", false)
        .order("severity", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole,
  });

  const { data: bannedUsers, refetch: refetchBans } = useQuery({
    queryKey: ["banned-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_bans")
        .select("*")
        .is("lifted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;

      // Fetch profiles for banned users
      if (data && data.length > 0) {
        const userIds = data.map((ban: BannedUser) => ban.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        return data.map((ban: BannedUser) => ({
          ...ban,
          profile: profiles?.find((p: any) => p.id === ban.user_id) || null,
        }));
      }

      return data as BannedUser[];
    },
    enabled: !!userRole,
  });

  const handleResolveReport = async (reportId: string, resolution: 'resolved' | 'dismissed') => {
    try {
      setLoading(reportId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("content_reports")
        .update({
          status: resolution,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;

      toast.success(`Report ${resolution}`);
      refetchReports();
    } catch (error: any) {
      console.error("Error resolving report:", error);
      toast.error(error.message || "Failed to resolve report");
    } finally {
      setLoading(null);
    }
  };

  const handleBanUser = async () => {
    if (!banUserId || !banReason) {
      toast.error("Please provide user ID and reason");
      return;
    }

    try {
      setLoading("ban");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const expiresAt = banType === "temporary" 
        ? new Date(Date.now() + parseInt(banDuration) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from("user_bans")
        .insert({
          user_id: banUserId,
          banned_by: user.id,
          reason: banReason,
          ban_type: banType,
          expires_at: expiresAt,
        });

      if (error) throw error;

      toast.success("User banned successfully");
      setBanDialogOpen(false);
      setBanUserId("");
      setBanReason("");
      setBanType("temporary");
      setBanDuration("7");
      refetchBans();
    } catch (error: any) {
      console.error("Error banning user:", error);
      toast.error(error.message || "Failed to ban user");
    } finally {
      setLoading(null);
    }
  };

  const handleUnbanUser = async (banId: string) => {
    try {
      setLoading(banId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_bans")
        .update({
          lifted_at: new Date().toISOString(),
          lifted_by: user.id,
        })
        .eq("id", banId);

      if (error) throw error;

      toast.success("User unbanned successfully");
      refetchBans();
    } catch (error: any) {
      console.error("Error unbanning user:", error);
      toast.error(error.message || "Failed to unban user");
    } finally {
      setLoading(null);
    }
  };

  const handleBanFromReport = async (reportedUserId: string, reportId: string) => {
    setBanUserId(reportedUserId);
    setBanDialogOpen(true);
  };

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page
          </p>
          <Button onClick={() => navigate('/feed')}>
            Go to Feed
          </Button>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Moderation Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{userRole}</Badge>
            <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Ban className="w-4 h-4" />
                  Ban User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ban User</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will restrict the user from accessing the platform.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      value={banUserId}
                      onChange={(e) => setBanUserId(e.target.value)}
                      placeholder="Enter user ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="banType">Ban Type</Label>
                    <Select value={banType} onValueChange={(v: "temporary" | "permanent") => setBanType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="temporary">Temporary</SelectItem>
                        <SelectItem value="permanent">Permanent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {banType === "temporary" && (
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (days)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={banDuration}
                        onChange={(e) => setBanDuration(e.target.value)}
                        min="1"
                        max="365"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                      id="reason"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Explain why this user is being banned"
                      rows={3}
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleBanUser}
                    disabled={loading === "ban"}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {loading === "ban" ? "Banning..." : "Ban User"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reports">
              <Flag className="w-4 h-4 mr-2" />
              Reports ({pendingReports?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="flags">
              <Eye className="w-4 h-4 mr-2" />
              Auto Flags ({contentFlags?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="bans">
              <UserX className="w-4 h-4 mr-2" />
              Banned ({bannedUsers?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-6">
            <div className="space-y-4">
              {pendingReports && pendingReports.length > 0 ? (
                pendingReports.map((report: any) => (
                  <Card key={report.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={report.profiles?.avatar_url} />
                            <AvatarFallback>
                              {report.profiles?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">
                              {report.profiles?.display_name || 'Anonymous'}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="destructive">{report.reason}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Type: </span>
                          <span className="font-semibold">{report.content_type}</span>
                        </div>
                        {report.description && (
                          <div>
                            <span className="text-sm text-muted-foreground">Description: </span>
                            <p className="mt-1">{report.description}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleResolveReport(report.id, 'resolved')}
                            disabled={loading === report.id}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResolveReport(report.id, 'dismissed')}
                            disabled={loading === report.id}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Dismiss
                          </Button>
                          {report.reported_user_id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleBanFromReport(report.reported_user_id, report.id)}
                              disabled={loading === report.id}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Ban User
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20">
                  <Flag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending reports</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="flags" className="mt-6">
            <div className="space-y-4">
              {contentFlags && contentFlags.length > 0 ? (
                contentFlags.map((flag: any) => (
                  <Card key={flag.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {flag.flag_type.replace(/_/g, ' ')}
                        </CardTitle>
                        <Badge variant={getSeverityColor(flag.severity) as any}>
                          {flag.severity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-muted-foreground">Type: </span>
                          <span className="font-semibold">{flag.content_type}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Created: </span>
                          <span>{formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}</span>
                        </div>
                        {flag.metadata && (
                          <div>
                            <span className="text-sm text-muted-foreground">Details: </span>
                            <pre className="text-xs mt-1 p-2 bg-secondary rounded">
                              {JSON.stringify(flag.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20">
                  <Eye className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No auto-flagged content</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="bans" className="mt-6">
            <div className="space-y-4">
              {bannedUsers && bannedUsers.length > 0 ? (
                bannedUsers.map((ban: BannedUser) => (
                  <Card key={ban.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={ban.profile?.avatar_url || ''} />
                            <AvatarFallback>
                              {ban.profile?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">
                              {ban.profile?.display_name || ban.user_id.slice(0, 8)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              @{ban.profile?.username || 'unknown'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={ban.ban_type === 'permanent' ? 'destructive' : 'default'}>
                          {ban.ban_type}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-muted-foreground">Reason: </span>
                          <span>{ban.reason}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Banned: </span>
                          <span>{formatDistanceToNow(new Date(ban.created_at), { addSuffix: true })}</span>
                        </div>
                        {ban.expires_at && (
                          <div>
                            <span className="text-sm text-muted-foreground">Expires: </span>
                            <span>{format(new Date(ban.expires_at), 'PPP')}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnbanUser(ban.id)}
                            disabled={loading === ban.id}
                          >
                            <Unlock className="w-4 h-4 mr-2" />
                            Unban User
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/profile/${ban.user_id}`)}
                          >
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20">
                  <UserX className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No banned users</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default Moderation;
