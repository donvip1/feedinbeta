import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Flag, Eye, Check, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";

const Moderation = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

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
          <Badge variant="outline">{userRole}</Badge>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reports">
              <Flag className="w-4 h-4 mr-2" />
              Reports ({pendingReports?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="flags">
              <Eye className="w-4 h-4 mr-2" />
              Auto Flags ({contentFlags?.length || 0})
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
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default Moderation;