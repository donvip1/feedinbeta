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
      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-24 z-20 flex flex-col items-center space-y-6">
        <button
          onClick={onLike}
          className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95"
        >
          <div className={`w-14 h-14 rounded-full ${isLiked ? 'bg-red-500/20' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center shadow-lg border-2 ${isLiked ? 'border-red-500' : 'border-white/20'}`}>
            <Heart className={`w-7 h-7 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
          </div>
          <span className="text-white font-semibold mt-1.5 text-sm drop-shadow-lg">{likesCount}</span>
        </button>

        <button
          onClick={onComment}
          className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95"
        >
          <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/20">
            <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
          </div>
          <span className="text-white font-semibold mt-1.5 text-sm drop-shadow-lg">{commentsCount}</span>
        </button>

        <button
          onClick={onSave}
          className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95"
        >
          <div className={`w-14 h-14 rounded-full ${isSaved ? 'bg-yellow-500/20' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center shadow-lg border-2 ${isSaved ? 'border-yellow-500' : 'border-white/20'}`}>
            <Bookmark className={`w-7 h-7 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
          </div>
        </button>

        <button
          onClick={onShare}
          className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95"
        >
          <div className={`w-14 h-14 rounded-full ${isRefed ? 'bg-green-500/20' : 'bg-black/40'} backdrop-blur-sm flex items-center justify-center shadow-lg border-2 ${isRefed ? 'border-green-500' : 'border-white/20'}`}>
            <Share2 className={`w-7 h-7 ${isRefed ? 'text-green-500' : 'text-white'} group-hover:scale-110 transition-transform`} />
          </div>
        </button>

        <button
          onClick={onPromote}
          className="flex flex-col items-center group transition-transform hover:scale-110 active:scale-95"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/20">
            <TrendingUp className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
          </div>
        </button>

        <div className="flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-white/20">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <span className="text-white font-semibold mt-1.5 text-sm drop-shadow-lg">{viewsCount}</span>
        </div>
      </div>

      {/* Video Controls */}
      {hasVideo && (
        <div className="absolute bottom-32 left-4 z-30 flex space-x-2 pointer-events-auto">
          {onToggleMute && (
            <Button
              size="sm"
              variant="secondary"
              onClickCapture={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleMute(e);
              }}
              className="rounded-full w-10 h-10 p-0 bg-black/40 backdrop-blur-sm border-2 border-white/20 hover:bg-black/60"
            >
              {isMuted ? <VolumeX className="w-5 h-5 pointer-events-none" /> : <Volume2 className="w-5 h-5 pointer-events-none" />}
            </Button>
          )}
          {onToggleFullScreen && (
            <Button
              size="sm"
              variant="secondary"
              onClickCapture={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleFullScreen(e);
              }}
              className="rounded-full w-10 h-10 p-0 bg-black/40 backdrop-blur-sm border-2 border-white/20 hover:bg-black/60"
            >
              <Maximize className="w-5 h-5 pointer-events-none" />
            </Button>
          )}
        </div>
      )}
    </>
  );
};
