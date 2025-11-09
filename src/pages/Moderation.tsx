import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Shield, Flag, Eye, Check, X, AlertTriangle, FileText, 
  Search, Filter, ChevronDown, AlertCircle, Ban, MessageSquare 
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const Moderation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showStrikeModal, setShowStrikeModal] = useState(false);
  const [strikeUserId, setStrikeUserId] = useState<string | null>(null);
  const [strikeReason, setStrikeReason] = useState("");
  const [strikeSeverity, setStrikeSeverity] = useState("low");
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);

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
        .maybeSingle();
      
      if (error) return null;
      return data?.role;
    },
  });

  const { data: pendingReports, refetch: refetchReports } = useQuery({
    queryKey: ["pending-reports", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("content_reports")
        .select(`
          *,
          reporter:profiles!content_reports_reporter_id_fkey (
            display_name,
            username,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userRole,
  });

  const { data: moderationQueue, refetch: refetchQueue } = useQuery({
    queryKey: ["moderation-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_queue")
        .select("*")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole,
  });

  const { data: appeals, refetch: refetchAppeals } = useQuery({
    queryKey: ["moderation-appeals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderation_appeals")
        .select(`
          *,
          user:profiles!moderation_appeals_user_id_fkey (
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

  const { data: userStrikes } = useQuery({
    queryKey: ["user-strikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_strikes")
        .select(`
          *,
          user:profiles!user_strikes_user_id_fkey (
            display_name,
            username,
            avatar_url
          ),
          issuer:profiles!user_strikes_issued_by_fkey (
            display_name,
            username
          )
        `)
        .eq("is_active", true)
        .order("issued_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: !!userRole,
  });

  const handleResolveReport = async (reportId: string, resolution: 'resolved' | 'dismissed', notes?: string) => {
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
          resolution_notes: notes || null,
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

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.length === 0) {
      toast.error("No items selected");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const status = action === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from("moderation_queue")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", selectedItems);

      if (error) throw error;

      toast.success(`${selectedItems.length} items ${status}`);
      setSelectedItems([]);
      refetchQueue();
    } catch (error: any) {
      console.error("Error in bulk action:", error);
      toast.error(error.message || "Failed to process bulk action");
    }
  };

  const handleIssueStrike = async () => {
    if (!strikeUserId || !strikeReason) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_strikes")
        .insert({
          user_id: strikeUserId,
          strike_type: "manual",
          reason: strikeReason,
          severity: strikeSeverity,
          issued_by: user.id,
        });

      if (error) throw error;

      toast.success("Strike issued successfully");
      setShowStrikeModal(false);
      setStrikeUserId(null);
      setStrikeReason("");
      setStrikeSeverity("low");
    } catch (error: any) {
      console.error("Error issuing strike:", error);
      toast.error(error.message || "Failed to issue strike");
    }
  };

  const handleAppealDecision = async (appealId: string, decision: 'approved' | 'rejected', notes: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("moderation_appeals")
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq("id", appealId);

      if (error) throw error;

      toast.success(`Appeal ${decision}`);
      setShowAppealModal(false);
      setSelectedAppeal(null);
      refetchAppeals();
    } catch (error: any) {
      console.error("Error processing appeal:", error);
      toast.error(error.message || "Failed to process appeal");
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!moderationQueue) return;
    setSelectedItems(moderationQueue.map((item: any) => item.id));
  };

  const deselectAll = () => {
    setSelectedItems([]);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const filteredReports = pendingReports?.filter((report: any) =>
    report.reporter?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    report.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Moderation Dashboard
          </h1>
          <Badge variant="outline" className="text-lg px-4 py-1">{userRole}</Badge>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reports">
              <Flag className="w-4 h-4 mr-2" />
              Reports ({pendingReports?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="queue">
              <Eye className="w-4 h-4 mr-2" />
              Review Queue ({moderationQueue?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="appeals">
              <MessageSquare className="w-4 h-4 mr-2" />
              Appeals ({appeals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="strikes">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Strikes ({userStrikes?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-4 pr-4">
                {filteredReports.length > 0 ? (
                  filteredReports.map((report: any) => (
                    <Card key={report.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={report.reporter?.avatar_url} />
                              <AvatarFallback>
                                {report.reporter?.display_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-base">
                                {report.reporter?.display_name || 'Anonymous'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                @{report.reporter?.username} • {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant="destructive">{report.reason}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Type: </span>
                              <span className="font-semibold">{report.content_type}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Status: </span>
                              <Badge variant="outline">{report.status}</Badge>
                            </div>
                          </div>
                          {report.description && (
                            <div className="bg-muted p-3 rounded-lg">
                              <span className="text-sm font-semibold">Description:</span>
                              <p className="mt-1 text-sm">{report.description}</p>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleResolveReport(report.id, 'resolved')}
                              disabled={loading === report.id || report.status !== 'pending'}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveReport(report.id, 'dismissed')}
                              disabled={loading === report.id || report.status !== 'pending'}
                            >
                              <X className="w-4 h-4 mr-2" />
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setStrikeUserId(report.reported_user_id);
                                setShowStrikeModal(true);
                              }}
                              disabled={!report.reported_user_id}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Issue Strike
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <Flag className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No reports found</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Review Queue Tab with Bulk Actions */}
          <TabsContent value="queue" className="mt-6">
            {moderationQueue && moderationQueue.length > 0 && (
              <div className="flex gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={selectAll}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={deselectAll}>
                  Deselect All
                </Button>
                {selectedItems.length > 0 && (
                  <>
                    <Button size="sm" variant="default" onClick={() => handleBulkAction('approve')}>
                      <Check className="w-4 h-4 mr-2" />
                      Approve ({selectedItems.length})
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleBulkAction('reject')}>
                      <X className="w-4 h-4 mr-2" />
                      Reject ({selectedItems.length})
                    </Button>
                  </>
                )}
              </div>
            )}
            
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-4 pr-4">
                {moderationQueue && moderationQueue.length > 0 ? (
                  moderationQueue.map((item: any) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleSelectItem(item.id)}
                            />
                            <div>
                              <CardTitle className="text-base capitalize">
                                {item.content_type}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={getPriorityColor(item.priority) as any}>
                            {item.priority} priority
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {item.suggested_action && (
                            <div>
                              <span className="text-sm text-muted-foreground">Suggested: </span>
                              <Badge variant="outline">{item.suggested_action}</Badge>
                            </div>
                          )}
                          {item.auto_labels && Array.isArray(item.auto_labels) && item.auto_labels.length > 0 && (
                            <div>
                              <span className="text-sm text-muted-foreground mb-2 block">AI Labels:</span>
                              <div className="flex flex-wrap gap-1">
                                {item.auto_labels.map((label: string, idx: number) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <Eye className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No content in review queue</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Appeals Tab */}
          <TabsContent value="appeals" className="mt-6">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-4 pr-4">
                {appeals && appeals.length > 0 ? (
                  appeals.map((appeal: any) => (
                    <Card key={appeal.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={appeal.user?.avatar_url} />
                              <AvatarFallback>
                                {appeal.user?.display_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-base">
                                {appeal.user?.display_name || 'Unknown User'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                @{appeal.user?.username} • {formatDistanceToNow(new Date(appeal.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{appeal.content_type}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="bg-muted p-3 rounded-lg">
                            <span className="text-sm font-semibold">Appeal:</span>
                            <p className="mt-1 text-sm">{appeal.appeal_text}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAppeal(appeal);
                              setShowAppealModal(true);
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Review Appeal
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No pending appeals</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Strikes Tab */}
          <TabsContent value="strikes" className="mt-6">
            <div className="mb-4">
              <Button onClick={() => setShowStrikeModal(true)}>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Issue New Strike
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-4 pr-4">
                {userStrikes && userStrikes.length > 0 ? (
                  userStrikes.map((strike: any) => (
                    <Card key={strike.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={strike.user?.avatar_url} />
                              <AvatarFallback>
                                {strike.user?.display_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-base">
                                {strike.user?.display_name || 'Unknown User'}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                @{strike.user?.username}
                              </p>
                            </div>
                          </div>
                          <Badge variant={getSeverityColor(strike.severity) as any}>
                            {strike.severity}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="bg-muted p-3 rounded-lg">
                            <span className="text-sm font-semibold">Reason:</span>
                            <p className="mt-1 text-sm">{strike.reason}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Issued by: </span>
                              <span className="font-semibold">{strike.issuer?.display_name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date: </span>
                              <span>{formatDistanceToNow(new Date(strike.issued_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                          {strike.expires_at && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Expires: </span>
                              <span>{formatDistanceToNow(new Date(strike.expires_at), { addSuffix: true })}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-20">
                    <AlertTriangle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active strikes</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Issue Strike Modal */}
      <Dialog open={showStrikeModal} onOpenChange={setShowStrikeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue User Strike</DialogTitle>
            <DialogDescription>
              Issue a warning or strike to a user for policy violations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={strikeUserId || ''}
                onChange={(e) => setStrikeUserId(e.target.value)}
                placeholder="Enter user ID"
              />
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={strikeSeverity} onValueChange={setStrikeSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={strikeReason}
                onChange={(e) => setStrikeReason(e.target.value)}
                placeholder="Explain the reason for this strike..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStrikeModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleIssueStrike}>
              Issue Strike
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appeal Review Modal */}
      <Dialog open={showAppealModal} onOpenChange={setShowAppealModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Appeal</DialogTitle>
            <DialogDescription>
              Review the user's appeal and make a decision
            </DialogDescription>
          </DialogHeader>
          {selectedAppeal && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Appeal Text:</h4>
                <p className="text-sm">{selectedAppeal.appeal_text}</p>
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea
                  id="resolution-notes"
                  placeholder="Add notes about your decision..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const notes = (document.getElementById('resolution-notes') as HTMLTextAreaElement)?.value;
                handleAppealDecision(selectedAppeal.id, 'rejected', notes);
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Reject Appeal
            </Button>
            <Button
              onClick={() => {
                const notes = (document.getElementById('resolution-notes') as HTMLTextAreaElement)?.value;
                handleAppealDecision(selectedAppeal.id, 'approved', notes);
              }}
            >
              <Check className="w-4 h-4 mr-2" />
              Approve Appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Moderation;