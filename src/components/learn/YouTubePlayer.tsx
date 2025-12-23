import React from 'react';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, title }) => {
  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title || 'YouTube video'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};

interface VideoCardProps {
  videoId: string;
  title: string;
  channel: string;
  thumbnail?: string;
  onClick?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  videoId,
  title,
  channel,
  thumbnail,
  onClick,
}) => {
  const thumbnailUrl = thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <div
      className="group cursor-pointer rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-all"
      onClick={onClick}
    >
      <div className="relative aspect-video">
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-primary-foreground ml-1"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="p-3">
        <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">{channel}</p>
      </div>
    </div>
  );
};
