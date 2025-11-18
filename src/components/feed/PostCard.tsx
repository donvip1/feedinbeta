import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2, Bookmark, Trash2, MoreVertical, Volume2, VolumeX, Maximize, Repeat2, TrendingUp, Music } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CommentsModal } from './CommentsModal';
import { ProfilePreviewModal } from '@/components/profile/ProfilePreviewModal';
import { SharePostModal } from './SharePostModal';
import { ProfileImageModal } from '@/components/profile/ProfileImageModal';
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
    music_url: string | null;
    music_title: string | null;
    music_artist: string | null;
    likes_count: number;
    comments_count: number;
    views_count: number;
    refeeds_count: number;
    created_at: string;
    allow_refeed?: boolean | null;
    profiles: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onUpdate: () => void;
  onCommentStateChange?: (isOpen: boolean) => void;
}

export const PostCard = ({ post, onUpdate, onCommentStateChange }: PostCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRefeeded, setIsRefeeded] = useState(false);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count);
  const [localRefeedsCount, setLocalRefeedsCount] = useState(post.refeeds_count);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Start unmuted when music is present
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iconTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onCommentStateChange?.(showComments);
  }, [showComments, onCommentStateChange]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      checkIfLiked();
      checkIfSaved();
      checkIfRefeeded();
    }
  }, [user, post.id]);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    
    if (video && post.media_type === 'video') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              video.play().then(() => setIsPlaying(true)).catch(() => {});
              if (audio && post.music_url) {
                audio.play().catch(() => {});
              }
              // Track view when post is visible
              if (!hasViewed) {
                trackView();
              }
            } else {
              video.pause();
              if (audio) audio.pause();
              setIsPlaying(false);
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(video);
      return () => observer.disconnect();
    } else if (!hasViewed && post.media_type !== 'video') {
      // For images and text posts, track view on mount
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasViewed) {
              trackView();
            }
          });
        },
        { threshold: 0.5 }
      );
      
      const element = document.getElementById(`post-${post.id}`);
      if (element) {
        observer.observe(element);
        return () => observer.disconnect();
      }
    }
  }, [post.media_type, hasViewed, post.id]);

  const trackView = async () => {
    if (!user || hasViewed) return;
    
    try {
      // Check if user has already viewed this post
      const { data: existingView } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Only insert if no existing view (one view per user)
      if (!existingView) {
        await supabase.from('post_views').insert({
          post_id: post.id,
          user_id: user.id
        });
        
        // Increment views count on the post
        await supabase
          .from('posts')
          .update({ views_count: (post.views_count || 0) + 1 })
          .eq('id', post.id);
        
        setHasViewed(true);
      } else {
        setHasViewed(true);
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

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

  const checkIfRefeeded = async () => {
    try {
      const { data } = await supabase
        .from('post_shares')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', user?.id)
        .eq('share_type', 'refeed')
        .maybeSingle();
      setIsRefeeded(!!data);
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
      if (type === 'refeed') {
        if (!user) return;
        
        // Check if refeed is allowed
        if (post.allow_refeed === false) {
          toast({ 
            title: 'Refeed not allowed', 
            description: 'The author has disabled refeeding for this post',
            variant: 'destructive' 
          });
          return;
        }
        
        // Optimistically update UI
        const prevRefeeded = isRefeeded;
        const prevCount = localRefeedsCount;
        setIsRefeeded(true);
        setLocalRefeedsCount(localRefeedsCount + 1);
        
        try {
          // Record the refeed in post_shares (which triggers count update)
          await supabase.from('post_shares').insert({
            post_id: post.id,
            user_id: user.id,
            share_type: 'refeed'
          });
          
          // Create a new post that refeeds this one
          await supabase.from('posts').insert([{
            user_id: user.id,
            feed_id: '', // Will be auto-generated by trigger
            content: `Refeed: ${post.content || ''}`,
            media_url: post.media_url,
            media_type: post.media_type,
            allow_refeed: true,
            allow_comments: true,
            status: 'active',
          }]);
          
          toast({ title: 'Post refeeded!' });
          onUpdate();
        } catch (err) {
          // Revert on error
          setIsRefeeded(prevRefeeded);
          setLocalRefeedsCount(prevCount);
          throw err;
        }
      } else if (type === 'quote') {
        // Quote refeed - navigate to create post with quote
        navigate('/feed', { 
          state: { 
            quotePost: {
              id: post.id,
              content: post.content,
              media_url: post.media_url,
              user: post.profiles
            }
          }
        });
      } else if (type === 'copy') {
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
      if (user && type !== 'refeed') await supabase.from('post_shares').insert({ post_id: post.id, user_id: user.id, share_type: type });
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
    <div className="w-full px-4">
      {/* User Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Avatar className="w-10 h-10 cursor-pointer flex-shrink-0" onClick={() => navigate(`/profile/${post.user_id}`)}>
            <AvatarImage src={post.profiles?.avatar_url || ''} />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white text-sm">{displayName[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex items-center space-x-2 min-w-0">
            <span className="font-semibold text-foreground text-sm cursor-pointer hover:underline truncate" onClick={() => navigate(`/profile/${post.user_id}`)}>{displayName}</span>
            <span className="text-muted-foreground text-xs flex-shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
        {(user?.id === post.user_id || isAdmin) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"><MoreVertical className="w-4 h-4 text-foreground" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-500"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Caption */}
      {post.content && !isTextOnly && (
        <div className="mb-3">
          <p className="text-foreground text-sm leading-relaxed">{post.content}</p>
        </div>
      )}

      {/* Media Card */}
      <div className="relative w-full aspect-[9/13] bg-black rounded-xl overflow-hidden">
        {post.media_url && (
          <div className="absolute inset-0">
            {post.media_type === 'image' && (
              <>
                <img 
                  src={post.media_url} 
                  alt="Post" 
                  className="w-full h-full object-cover select-none pointer-events-auto"
                  onContextMenu={(e) => e.preventDefault()}
                  draggable={false}
                />
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowImageModal(true);
                  }} 
                  className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition"
                >
                  <Maximize className="w-5 h-5 text-white" />
                </button>
              </>
            )}
            {post.media_type === 'video' && (
              <>
                <video 
                  ref={videoRef} 
                  src={post.media_url} 
                  className="w-full h-full object-cover select-none" 
                  loop 
                  playsInline
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  disablePictureInPicture
                  onClick={(e) => {
                    e.stopPropagation();
                    const video = videoRef.current;
                    if (video) {
                      if (isPlaying) {
                        video.pause();
                        if (audioRef.current) audioRef.current.pause();
                        setIsPlaying(false);
                      } else {
                        video.play().then(() => {
                          if (audioRef.current && post.music_url) audioRef.current.play();
                        });
                        setIsPlaying(true);
                      }
                      setShowPlayIcon(true);
                      if (iconTimeoutRef.current) clearTimeout(iconTimeoutRef.current);
                      iconTimeoutRef.current = setTimeout(() => setShowPlayIcon(false), 800);
                    }
                  }}
                />
                {post.music_url && <audio ref={audioRef} src={post.music_url} loop />}
                
                {/* Play/Pause Icon Overlay */}
                {showPlayIcon && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-black/40 backdrop-blur-sm rounded-full p-8 animate-in fade-in zoom-in-95 duration-200">
                      {isPlaying ? (
                        <div className="flex space-x-2">
                          <div className="w-2 h-12 bg-white rounded-full"></div>
                          <div className="w-2 h-12 bg-white rounded-full"></div>
                        </div>
                      ) : (
                        <div className="w-0 h-0 border-t-[24px] border-t-transparent border-l-[36px] border-l-white border-b-[24px] border-b-transparent ml-2"></div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Music Info Display */}
                {post.music_url && post.music_title && (
                  <div className="absolute bottom-16 left-3 right-3 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <Music className="w-4 h-4 text-white flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{post.music_title}</p>
                        <p className="text-white/70 text-[10px] truncate">{post.music_artist || 'Unknown Artist'}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      const newMutedState = !isMuted;
                      setIsMuted(newMutedState);
                      if (videoRef.current) videoRef.current.muted = newMutedState;
                      if (audioRef.current) audioRef.current.muted = newMutedState;
                    }} 
                    className="bg-black/50 backdrop-blur-sm rounded-full p-2 hover:bg-black/70 transition"
                  >
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
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-500 p-8">
            <div className="w-full max-w-lg">
              <p className="text-white font-semibold text-center leading-relaxed" 
                 style={{
                   fontSize: post.content.length < 50 ? '2rem' : 
                            post.content.length < 150 ? '1.75rem' :
                            post.content.length < 300 ? '1.5rem' : '1.25rem',
                   lineHeight: post.content.length < 50 ? '2.5rem' : 
                              post.content.length < 150 ? '2.25rem' :
                              post.content.length < 300 ? '2rem' : '1.75rem',
                 }}>
                {post.content}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Social Actions */}
      <div className="flex items-center justify-between mt-3 mb-4">
        <div className="flex items-center space-x-5">
          <button onClick={handleLike} disabled={isLiking} className="flex items-center space-x-1.5 hover:opacity-70 transition">
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
            <span className="text-foreground text-xs font-medium">{localLikesCount > 999 ? `${(localLikesCount / 1000).toFixed(1)}K` : localLikesCount}</span>
          </button>
          
          <button onClick={() => setShowComments(true)} data-comment-button className="flex items-center space-x-1.5 hover:opacity-70 transition">
            <MessageCircle className="w-4 h-4 text-foreground" />
            <span className="text-foreground text-xs font-medium">{post.comments_count}</span>
          </button>
          
          <button className="flex items-center space-x-1.5 hover:opacity-70 transition">
            <Eye className="w-4 h-4 text-foreground" />
            <span className="text-foreground text-xs font-medium">{post.views_count > 999 ? `${(post.views_count / 1000).toFixed(1)}K` : post.views_count}</span>
          </button>
          
          <button onClick={() => handleShare('refeed')} className="flex items-center space-x-1.5 hover:opacity-70 transition">
            <Repeat2 className={`w-4 h-4 ${isRefeeded ? 'text-pink-500' : 'text-foreground'}`} />
            <span className={`text-xs font-medium ${isRefeeded ? 'text-pink-500' : 'text-foreground'}`}>
              {localRefeedsCount > 999 ? `${(localRefeedsCount / 1000).toFixed(1)}K` : localRefeedsCount}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-1.5 hover:opacity-70 transition">
                <Share2 className="w-4 h-4 text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleShare('quote')}>
                Quote Refeed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowShareModal(true)}>
                Share Post
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSave}>
                <Bookmark className={`w-4 h-4 mr-2 ${isSaved ? 'fill-foreground' : ''}`} />
                {isSaved ? 'Unsave' : 'Save Post'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('copy')}>Copy Link</DropdownMenuItem>
              {post.media_url && <DropdownMenuItem onClick={() => handleShare('download')}>Download</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Promote button on the right */}
        <button 
          onClick={() => navigate(`/promote/${post.id}`)} 
          className="flex items-center space-x-1.5 hover:opacity-70 transition text-primary"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">Promote</span>
        </button>
      </div>

      <CommentsModal open={showComments} onClose={() => setShowComments(false)} postId={post.id} postOwnerId={post.user_id} post={post} />
      <ProfilePreviewModal open={showProfilePreview} onClose={() => setShowProfilePreview(false)} userId={post.user_id} />
      <SharePostModal 
        open={showShareModal} 
        onClose={() => setShowShareModal(false)} 
        post={{ id: post.id, content: post.content, media_url: post.media_url, user_id: post.user_id }} 
      />
      {post.media_type === 'image' && post.media_url && (
        <ProfileImageModal
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
          imageUrl={post.media_url}
          title={`Photo by ${post.profiles?.display_name || post.profiles?.username || 'User'}`}
        />
      )}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Post?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this post.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};