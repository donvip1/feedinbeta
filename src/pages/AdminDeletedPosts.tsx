import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  RefreshCw, 
  Trash2, 
  Eye, 
  Shield,
  ArrowLeft,
  Image as ImageIcon,
  Video,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeletedPost {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string | null;
}

interface UserProfile {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function AdminDeletedPosts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [deletedPosts, setDeletedPosts] = useState<DeletedPost[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [restorePostId, setRestorePostId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDeletedPosts = async () => {
    if (!searchUsername.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to search.",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    setDeletedPosts([]);
    setUserProfile(null);

    try {
      // First get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('username', searchUsername.trim().toLowerCase())
        .single();

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          toast({
            title: "User not found",
            description: `No user found with username "${searchUsername}"`,
            variant: "destructive",
          });
        } else {
          throw profileError;
        }
        return;
      }

      setUserProfile({
        username: profileData.username,
        display_name: profileData.display_name,
        avatar_url: profileData.avatar_url,
      });

      // Get deleted posts for this user
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, feed_id, user_id, content, media_url, media_type, deleted_at, deleted_by, created_at')
        .eq('user_id', profileData.id)
        .eq('status', 'deleted')
        .order('deleted_at', { ascending: false });

      if (postsError) throw postsError;

      setDeletedPosts(postsData || []);

      if (!postsData || postsData.length === 0) {
        toast({
          title: "No deleted posts",
          description: `User "${searchUsername}" has no deleted posts.`,
        });
      }
    } catch (error) {
      console.error('Error searching deleted posts:', error);
      toast({
        title: "Error",
        description: "Failed to search for deleted posts.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  const handleRestorePost = async () => {
    if (!restorePostId) return;

    setRestoring(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ 
          status: 'active',
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', restorePostId);

      if (error) throw error;

      // Remove from local state
      setDeletedPosts(deletedPosts.filter(p => p.id !== restorePostId));

      toast({
        title: "Post restored",
        description: "The post has been successfully restored.",
      });
    } catch (error) {
      console.error('Error restoring post:', error);
      toast({
        title: "Error",
        description: "Failed to restore post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
      setRestorePostId(null);
    }
  };

  const getMediaIcon = (mediaType: string | null) => {
    if (!mediaType) return <FileText className="w-4 h-4" />;
    if (mediaType === 'video') return <Video className="w-4 h-4" />;
    if (mediaType === 'image') return <ImageIcon className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[50vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  if (!user || !isAdmin) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Shield className="w-16 h-16 text-destructive" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-md">
            This page is only accessible to platform administrators.
          </p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Admin: Deleted Posts Recovery
            </h1>
            <p className="text-muted-foreground text-sm">
              Search and restore deleted posts by username
            </p>
          </div>
        </div>

        {/* Search Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Search Deleted Posts</CardTitle>
            <CardDescription>
              Enter a username to find their deleted posts for security review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchDeletedPosts()}
                className="flex-1"
              />
              <Button 
                onClick={searchDeletedPosts} 
                disabled={searching}
              >
                {searching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Search</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User Profile Card */}
        {userProfile && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {userProfile.avatar_url ? (
                    <img 
                      src={userProfile.avatar_url} 
                      alt={userProfile.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">{userProfile.display_name || userProfile.username}</p>
                  <p className="text-sm text-muted-foreground">@{userProfile.username}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {deletedPosts.length} deleted post{deletedPosts.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deleted Posts List */}
        {deletedPosts.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Deleted Posts</h3>
            {deletedPosts.map((post) => (
              <Card key={post.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Media Preview */}
                    <div className="w-24 h-24 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {post.media_url && post.media_type === 'image' ? (
                        <img 
                          src={post.media_url} 
                          alt="Post media"
                          className="w-full h-full object-cover"
                        />
                      ) : post.media_url && post.media_type === 'video' ? (
                        <video 
                          src={post.media_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {getMediaIcon(post.media_type)}
                        </div>
                      )}
                    </div>

                    {/* Post Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {post.content ? (
                            <p className="text-sm line-clamp-2 break-words">{post.content}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {post.media_type === 'image' ? 'Image post' : 
                               post.media_type === 'video' ? 'Video post' : 'No content'}
                            </p>
                          )}
                        </div>
                        <Badge variant="destructive" className="flex-shrink-0">
                          <Trash2 className="w-3 h-3 mr-1" />
                          Deleted
                        </Badge>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created: {post.created_at ? format(new Date(post.created_at), 'MMM d, yyyy') : 'Unknown'}
                        </span>
                        {post.deleted_at && (
                          <span className="flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />
                            Deleted: {format(new Date(post.deleted_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/feed/post/${post.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => setRestorePostId(post.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {userProfile && deletedPosts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Trash2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No deleted posts found for this user.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restorePostId} onOpenChange={() => setRestorePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the post and make it visible again on the user's profile and in feeds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestorePost} 
              disabled={restoring}
              className="bg-primary hover:bg-primary/90"
            >
              {restoring ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Restore Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}