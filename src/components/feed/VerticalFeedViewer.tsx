import { useState, useRef, useEffect } from "react";
import { PostCard } from "./PostCard";
import { useInView } from "react-intersection-observer";

interface Post {
  id: string;
  feed_id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  aspect_ratio?: string;
  has_blur_background?: boolean;
  likes_count: number;
  comments_count: number;
  views_count: number;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface VerticalFeedViewerProps {
  posts: Post[];
  onRefresh: () => void;
}

export const VerticalFeedViewer = ({ posts, onRefresh }: VerticalFeedViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Auto-play/pause logic
  useEffect(() => {
    const currentPost = posts[currentIndex];
    if (!currentPost) return;

    // Pause all other videos
    videoRefs.current.forEach((video, postId) => {
      if (postId !== currentPost.id) {
        video.pause();
      }
    });

    // Play current video
    const currentVideo = videoRefs.current.get(currentPost.id);
    if (currentVideo && currentPost.media_type === 'video') {
      currentVideo.muted = true;
      currentVideo.play().catch(console.error);
    }
  }, [currentIndex, posts]);

  // Scroll snap handling
  const handleScroll = () => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const viewHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / viewHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
      setCurrentIndex(newIndex);
    }
  };

  // Debounced scroll handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const debouncedScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };

    container.addEventListener('scroll', debouncedScroll);
    return () => {
      container.removeEventListener('scroll', debouncedScroll);
      clearTimeout(timeoutId);
    };
  }, [currentIndex, posts.length]);

  const registerVideo = (postId: string, video: HTMLVideoElement | null) => {
    if (video) {
      videoRefs.current.set(postId, video);
    } else {
      videoRefs.current.delete(postId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      style={{ scrollBehavior: 'smooth' }}
    >
      {posts.map((post, index) => (
        <div
          key={post.id}
          className="h-screen w-full snap-start snap-always flex items-center justify-center relative bg-black"
        >
          <FeedPostCard
            post={post}
            isActive={index === currentIndex}
            onVideoRef={(video) => registerVideo(post.id, video)}
            onUpdate={onRefresh}
          />
        </div>
      ))}
    </div>
  );
};

interface FeedPostCardProps {
  post: Post;
  isActive: boolean;
  onVideoRef: (video: HTMLVideoElement | null) => void;
  onUpdate: () => void;
}

const FeedPostCard = ({ post, isActive, onVideoRef, onUpdate }: FeedPostCardProps) => {
  const [ref, inView] = useInView({ threshold: 0.5 });

  const getAspectRatioClasses = () => {
    const ratio = post.aspect_ratio || '9:16';
    if (ratio === '9:16') return 'w-full h-full';
    if (ratio === '16:9') return 'w-full h-auto max-h-full';
    return 'w-auto h-full max-w-full';
  };

  const renderMedia = () => {
    if (!post.media_url) return null;

    const mediaClasses = `${getAspectRatioClasses()} object-cover`;

    if (post.media_type === 'video') {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {post.has_blur_background && (
            <video
              className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30"
              src={post.media_url}
              loop
              playsInline
            />
          )}
          <video
            ref={onVideoRef}
            className={`relative z-10 ${mediaClasses}`}
            src={post.media_url}
            loop
            playsInline
            muted
            controls={false}
          />
        </div>
      );
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {post.has_blur_background && (
          <img
            src={post.media_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30"
          />
        )}
        <img
          src={post.media_url}
          alt={post.content || 'Post image'}
          className={`relative z-10 ${mediaClasses}`}
        />
      </div>
    );
  };

  return (
    <div ref={ref} className="relative w-full h-full">
      {renderMedia()}
      
      {/* Overlay with action buttons */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full flex">
          <div className="flex-1" />
          
          {/* Right side action buttons - safe zone */}
          <div className="w-20 flex flex-col justify-end pb-24 pr-4 gap-6 pointer-events-auto">
            {/* Like, Comment, Share buttons will be integrated from PostCard */}
          </div>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center gap-2 mb-2">
            <img
              src={post.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles.username}`}
              alt={post.profiles.display_name || post.profiles.username}
              className="w-10 h-10 rounded-full border-2 border-white"
            />
            <div>
              <p className="text-white font-semibold">
                {post.profiles.display_name || post.profiles.username}
              </p>
              <p className="text-white/70 text-sm">@{post.profiles.username}</p>
            </div>
          </div>
          
          {post.content && (
            <p className="text-white text-sm line-clamp-2">{post.content}</p>
          )}
        </div>
      </div>
    </div>
  );
};