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
      {/* Horizontal Bottom Actions */}
      <div className="absolute bottom-4 left-0 right-0 z-20 px-4">
        <div className="flex items-center justify-around bg-black/60 backdrop-blur-md rounded-full py-3 px-2 border border-white/10">
          <button
            onClick={onLike}
            className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95 min-w-[60px]"
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
            <span className="text-white font-semibold mt-0.5 text-xs drop-shadow-lg">{likesCount}</span>
          </button>

          <button
            onClick={onComment}
            className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95 min-w-[60px]"
          >
            <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <span className="text-white font-semibold mt-0.5 text-xs drop-shadow-lg">{commentsCount}</span>
          </button>

          <button
            onClick={onSave}
            className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95 min-w-[60px]"
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
            <span className="text-white/70 font-medium mt-0.5 text-[10px] drop-shadow-lg">Save</span>
          </button>

          <button
            onClick={onShare}
            className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95 min-w-[60px]"
          >
            <Share2 className={`w-6 h-6 ${isRefed ? 'text-green-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
            <span className="text-white/70 font-medium mt-0.5 text-[10px] drop-shadow-lg">Share</span>
          </button>

          <button
            onClick={onPromote}
            className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95 min-w-[60px]"
          >
            <TrendingUp className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-white/70 font-medium mt-0.5 text-[10px] drop-shadow-lg">Boost</span>
          </button>

          <div className="flex flex-col items-center min-w-[60px]">
            <Eye className="w-6 h-6 text-white/80" />
            <span className="text-white font-semibold mt-0.5 text-xs drop-shadow-lg">{viewsCount}</span>
          </div>
        </div>
      </div>

      {/* Video Controls - Stay in original position */}
      {hasVideo && (
        <div className="absolute top-4 right-4 z-20 flex space-x-2">
          {onToggleMute && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onToggleMute}
              className="rounded-full w-10 h-10 p-0 bg-black/40 backdrop-blur-sm border-2 border-white/20 hover:bg-black/60"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
          )}
          {onToggleFullScreen && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onToggleFullScreen}
              className="rounded-full w-10 h-10 p-0 bg-black/40 backdrop-blur-sm border-2 border-white/20 hover:bg-black/60"
            >
              <Maximize className="w-5 h-5" />
            </Button>
          )}
        </div>
      )}
    </>
  );
};
