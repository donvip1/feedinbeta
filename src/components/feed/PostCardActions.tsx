import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Eye, Share2, Bookmark, TrendingUp, Volume2, VolumeX, Maximize } from 'lucide-react';

interface PostCardActionsProps {
  isLiked: boolean;
  isSaved: boolean;
  isRefed: boolean;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  hasVideo: boolean;
  isMuted: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onPromote: () => void;
  onToggleMute?: (e: React.MouseEvent) => void;
  onToggleFullScreen?: (e: React.MouseEvent) => void;
}

export const PostCardActions = ({
  isLiked,
  isSaved,
  isRefed,
  likesCount,
  commentsCount,
  viewsCount,
  hasVideo,
  isMuted,
  onLike,
  onComment,
  onShare,
  onSave,
  onPromote,
  onToggleMute,
  onToggleFullScreen,
}: PostCardActionsProps) => {
  return (
    <>
      {/* Horizontal Bottom Actions Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="flex items-center justify-around bg-gradient-to-t from-black/80 via-black/60 to-transparent backdrop-blur-sm py-4 px-4">
          <button
            onClick={onLike}
            className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-95"
          >
            <Heart className={`w-7 h-7 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'} group-hover:scale-110 transition-transform drop-shadow-lg`} />
            <span className="text-white font-semibold text-xs drop-shadow-lg">{likesCount}</span>
          </button>

          <button
            onClick={onComment}
            className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-95"
          >
            <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform drop-shadow-lg" />
            <span className="text-white font-semibold text-xs drop-shadow-lg">{commentsCount}</span>
          </button>

          <button
            onClick={onSave}
            className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-95"
          >
            <Bookmark className={`w-7 h-7 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-white'} group-hover:scale-110 transition-transform drop-shadow-lg`} />
            <span className="text-white/90 font-medium text-[10px] drop-shadow-lg">Save</span>
          </button>

          <button
            onClick={onShare}
            className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-95"
          >
            <Share2 className={`w-7 h-7 ${isRefed ? 'text-green-500' : 'text-white'} group-hover:scale-110 transition-transform drop-shadow-lg`} />
            <span className="text-white/90 font-medium text-[10px] drop-shadow-lg">Share</span>
          </button>

          <button
            onClick={onPromote}
            className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-95"
          >
            <TrendingUp className="w-7 h-7 text-purple-400 group-hover:scale-110 transition-transform drop-shadow-lg" />
            <span className="text-white/90 font-medium text-[10px] drop-shadow-lg">Boost</span>
          </button>

          <div className="flex flex-col items-center gap-1">
            <Eye className="w-7 h-7 text-white/80 drop-shadow-lg" />
            <span className="text-white font-semibold text-xs drop-shadow-lg">{viewsCount}</span>
          </div>
        </div>
      </div>

      {/* Video Controls - Top Right */}
      {hasVideo && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          {onToggleMute && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onToggleMute}
              className="rounded-full w-10 h-10 p-0 bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 shadow-lg"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </Button>
          )}
          {onToggleFullScreen && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onToggleFullScreen}
              className="rounded-full w-10 h-10 p-0 bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 shadow-lg"
            >
              <Maximize className="w-5 h-5 text-white" />
            </Button>
          )}
        </div>
      )}
    </>
  );
};
