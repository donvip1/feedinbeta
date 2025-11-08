import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Music } from 'lucide-react';

interface PostCardHeaderProps {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  createdAt: string;
  musicTitle?: string | null;
  musicArtist?: string | null;
  isOriginalAudio?: boolean;
  onUserClick: () => void;
  onMusicClick?: () => void;
}

export const PostCardHeader = ({
  userId,
  avatarUrl,
  displayName,
  username,
  createdAt,
  musicTitle,
  musicArtist,
  isOriginalAudio,
  onUserClick,
  onMusicClick,
}: PostCardHeaderProps) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/60 to-transparent">
      <div className="flex items-center space-x-3">
        <Avatar 
          className="w-12 h-12 cursor-pointer hover:opacity-80 ring-2 ring-white/20" 
          onClick={onUserClick}
        >
          <AvatarImage src={avatarUrl || ''} />
          <AvatarFallback className="bg-gradient-to-br from-pink-500 to-blue-500 text-white">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p 
            className="font-bold text-white cursor-pointer hover:underline truncate text-lg inline-block max-w-fit"
            onClick={onUserClick}
          >
            {displayName}
          </p>
          <div className="flex items-center space-x-2 text-sm">
            {username && (
              <span 
                className="cursor-pointer hover:underline text-white/80 truncate inline-block max-w-fit"
                onClick={onUserClick}
              >
                @{username}
              </span>
            )}
            <span className="text-white/60">•</span>
            <span className="text-white/60">
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </span>
          </div>
          
          {musicTitle && musicArtist && (
            <div 
              className="flex items-center gap-1.5 mt-1 cursor-pointer hover:underline group"
              onClick={onMusicClick}
            >
              <Music className="w-3.5 h-3.5 text-white/90 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-white/90 truncate max-w-[200px]">
                {isOriginalAudio ? 'Original Audio' : `${musicArtist} - ${musicTitle}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
