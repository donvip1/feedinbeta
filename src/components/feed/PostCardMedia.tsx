interface PostCardMediaProps {
  mediaUrl: string | null;
  mediaType: string | null;
  content: string | null;
  aspectRatio?: string;
  hasBlurBackground?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  isMuted?: boolean;
  onVideoClick?: (e: React.MouseEvent) => void;
}

export const PostCardMedia = ({
  mediaUrl,
  mediaType,
  content,
  aspectRatio,
  hasBlurBackground,
  videoRef,
  isMuted = true,
  onVideoClick,
}: PostCardMediaProps) => {
  const getTextSize = (text: string) => {
    const length = text.length;
    if (length <= 30) return 'text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl';
    if (length <= 60) return 'text-base sm:text-lg md:text-xl lg:text-xl xl:text-2xl';
    if (length <= 100) return 'text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl';
    if (length <= 150) return 'text-xs sm:text-sm md:text-base lg:text-base xl:text-lg';
    if (length <= 250) return 'text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base';
    return 'text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base';
  };

  const getGradientBackground = (seed: string) => {
    const gradients = [
      'from-purple-600 via-purple-500 to-blue-500',
      'from-pink-500 via-red-500 to-yellow-500',
      'from-green-500 via-teal-500 to-blue-500',
      'from-indigo-600 via-purple-600 to-pink-500',
      'from-orange-500 via-red-500 to-pink-500',
      'from-blue-600 via-indigo-600 to-purple-600',
    ];
    const index = parseInt(seed.slice(0, 8), 16) % gradients.length;
    return gradients[index];
  };

  const isTextOnly = !mediaUrl && content;

  if (isTextOnly) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${getGradientBackground(content)}`}>
        <div className="px-8 py-6 text-center max-w-2xl">
          <p className={`${getTextSize(content)} font-bold text-white leading-relaxed whitespace-pre-wrap break-words`}>
            {content}
          </p>
        </div>
      </div>
    );
  }

  if (mediaType === 'video' && mediaUrl) {
    return (
      <video
        ref={videoRef}
        src={mediaUrl}
        className={`absolute inset-0 w-full h-full object-${aspectRatio === '1:1' ? 'contain' : 'cover'} ${hasBlurBackground ? 'backdrop-blur-xl' : ''}`}
        loop
        playsInline
        muted={isMuted}
        onClick={onVideoClick}
        style={{
          backgroundColor: hasBlurBackground ? 'rgba(0,0,0,0.5)' : 'transparent',
        }}
      />
    );
  }

  if (mediaType === 'image' && mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt="Post content"
        className={`absolute inset-0 w-full h-full object-${aspectRatio === '1:1' ? 'contain' : 'cover'} ${hasBlurBackground ? 'backdrop-blur-xl' : ''}`}
        style={{
          backgroundColor: hasBlurBackground ? 'rgba(0,0,0,0.5)' : 'transparent',
        }}
      />
    );
  }

  return null;
};
