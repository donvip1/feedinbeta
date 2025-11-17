import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2, Bookmark, Trash2, MoreVertical, Volume2, VolumeX, Maximize } from 'lucide-react';
import { format } from 'date-fns';
import { CommentsModal } from './CommentsModal';
import { ProfilePreviewModal } from '@/components/profile/ProfilePreviewModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PostCardProps {
  post: {
    id: string;
    feed_id: string;
    user_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onUpdate: () => void;
}

export const PostCard = ({ post, onUpdate }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      checkIfLiked();
      checkIfSaved();
    }
  }, [user, post.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && post.media_type === 'video') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().then(() => setIsPlaying(true)).catch(() => {});
            } else {
              video.pause();
              setIsPlaying(false);
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(video);
      return () => observer.disconnect();
    }
  }, [post.media_type]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user?.id).single();
      setIsAdmin(data?.role === 'admin' || data?.role === 'moderator');
    } catch (error) {}
  };

  const checkIfLiked = async () => {
    try {
      const { data } = await supabase.from('post_likes').select('*').eq('post_id', post.id).eq('user_id', user?.id).maybeSingle();
      setIsLiked(!!data);
    } catch (error) {}
  };

  const checkIfSaved = async () => {
    try {
      const { data } = await supabase.from('saved_posts').select('*').eq('post_id', post.id).eq('user_id', user?.id).maybeSingle();
      setIsSaved(!!data);
    } catch (error) {}
  };

  const handleLike = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    const prev = { liked: isLiked, count: localLikesCount };
    setIsLiked(!isLiked);
    setLocalLikesCount(p => isLiked ? p - 1 : p + 1);

    try {
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      }
    } catch (error: any) {
      setIsLiked(prev.liked);
      setLocalLikesCount(prev.count);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const prev = isSaved;
    setIsSaved(!isSaved);
    try {
      if (isSaved) {
        await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
        toast({ title: 'Removed from saved' });
      } else {
        await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
        toast({ title: 'Post saved' });
      }
    } catch (error: any) {
      setIsSaved(prev);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleShare = async (type: string) => {
    try {
      if (type === 'copy') {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        toast({ title: 'Link copied!' });
      } else if (type === 'download' && post.media_url) {
        const res = await fetch(post.media_url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feedin-${post.id}.${post.media_type === 'video' ? 'mp4' : 'jpg'}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (user) await supabase.from('post_shares').insert({ post_id: post.id, user_id: user.id, share_type: type });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await supabase.from('posts').delete().eq('id', post.id);
      toast({ title: 'Post deleted' });
      setShowDeleteDialog(false);
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Anonymous';
  const isTextOnly = !post.media_url && post.content;

  return (
    <div className="w-full mb-16 pb-4">
      {/* User Header */}
      <div className="flex items-center justify-between px-3 mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Avatar className="w-10 h-10 cursor-pointer flex-shrink-0" onClick={() => navigate(`/profile/${post.user_id}`)}>
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-sm">{displayName[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex items-center space-x-2 min-w-0">
            <span className="font-semibold text-white text-sm cursor-pointer hover:underline truncate" onClick={() => navigate(`/profile/${post.user_id}`)}>{displayName}</span>
            <span className="text-white/60 text-xs flex-shrink-0">{format(new Date(post.created_at), 'h\'h\'')}</span>
          </div>
        </div>
        {(user?.id === post.user_id || isAdmin) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"><MoreVertical className="w-4 h-4 text-white" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Caption */}
      {post.content && !isTextOnly && (
        <div className="px-3 mb-3">
          <p className="text-white text-sm leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Media Card */}
      <div className="relative w-full aspect-[9/16] bg-black rounded-xl overflow-hidden mx-3" style={{ maxWidth: 'calc(100% - 24px)' }}>
        {post.media_url && (
          <div className="absolute inset-0">
            {post.media_type === 'image' && <img src={post.media_url} alt="Post" className="w-full h-full object-cover" />}
            {post.media_type === 'video' && (
              <>
                <video ref={videoRef} src={post.media_url} className="w-full h-full object-cover" loop playsInline muted={isMuted} onClick={() => videoRef.current && (isPlaying ? videoRef.current.pause() : videoRef.current.play())} />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition">
                    {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); videoRef.current && (document.fullscreenElement ? document.exitFullscreen() : videoRef.current.requestFullscreen()); }} className="bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition">
                    <Maximize className="w-5 h-5 text-white" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {isTextOnly && post.content && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-8">
            <p className="text-white font-bold text-center text-2xl">{post.content}</p>
          </div>
        )}
      </div>

      {/* Social Actions */}
      <div className="flex items-center space-x-5 px-3 mt-3 mb-4">
        <button onClick={handleLike} disabled={isLiking} className="flex items-center space-x-1.5 hover:opacity-70 transition">
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          <span className="text-white text-xs font-medium">{localLikesCount > 999 ? `${(localLikesCount / 1000).toFixed(1)}K` : localLikesCount}</span>
        </button>
        
        <button onClick={() => setShowComments(true)} className="flex items-center space-x-1.5 hover:opacity-70 transition">
          <MessageCircle className="w-4 h-4 text-white" />
          <span className="text-white text-xs font-medium">{post.comments_count}</span>
        </button>
        
        <button onClick={handleSave} className="flex items-center space-x-1.5 hover:opacity-70 transition">
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-white' : ''} text-white`} />
          <span className="text-white text-xs font-medium">{post.views_count > 999 ? `${(post.views_count / 1000).toFixed(1)}K` : post.views_count}</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center space-x-1.5 hover:opacity-70 transition">
              <Share2 className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-medium">{post.views_count > 999 ? `${(post.views_count / 1000).toFixed(1)}K` : post.views_count}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleShare('copy')}>Copy Link</DropdownMenuItem>
            {post.media_url && <DropdownMenuItem onClick={() => handleShare('download')}>Download</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => navigate(`/promote/${post.id}`)}>Promote Post</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommentsModal open={showComments} onClose={() => { setShowComments(false); onUpdate(); }} postId={post.id} postOwnerId={post.user_id} />
      <ProfilePreviewModal open={showProfilePreview} onClose={() => setShowProfilePreview(false)} userId={post.user_id} />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Post?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this post.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};