import { Heart, MessageCircle, Share2, Play, Plus, MoreHorizontal, Music2 } from 'lucide-react';

interface AdPreviewDeviceProps {
  username: string;
  caption: string;
  ctaText: string;
  mediaUrl?: string;
  mediaType?: string;
  profilePic?: string;
  isPromoted?: boolean;
}

export const AdPreviewDevice = ({
  username,
  caption,
  ctaText,
  mediaUrl,
  mediaType = 'image',
  profilePic,
  isPromoted = true,
}: AdPreviewDeviceProps) => {
  return (
    <div className="relative w-[300px] h-[600px] bg-black rounded-[2.5rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden mx-auto">
      {/* Media Content */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
        {mediaUrl ? (
          mediaType === 'video' ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              muted
              loop
              autoPlay
              playsInline
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Ad preview"
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="text-slate-500 flex flex-col items-center gap-2">
            <Play size={48} className="opacity-20" />
            <span className="text-sm font-medium">Preview Content</span>
          </div>
        )}

        {/* Top Navigation Overlay */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex gap-4 font-semibold text-xs text-white">
            <span className="opacity-60">Following</span>
            <span className="border-b-2 border-white pb-1">For You</span>
          </div>
          <MoreHorizontal size={18} className="text-white" />
        </div>

        {/* Right Side Interaction Bar */}
        <div className="absolute right-2 bottom-32 flex flex-col items-center gap-4">
          {/* Profile */}
          <div className="relative mb-2">
            <div className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-slate-700">
              {profilePic ? (
                <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600" />
              )}
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-pink-500 rounded-full p-0.5">
              <Plus size={10} strokeWidth={4} className="text-white" />
            </div>
          </div>

          <div className="flex flex-col items-center text-white">
            <Heart size={28} fill="white" />
            <span className="text-[10px] font-bold mt-0.5">124.5K</span>
          </div>

          <div className="flex flex-col items-center text-white">
            <MessageCircle size={28} fill="white" />
            <span className="text-[10px] font-bold mt-0.5">1,204</span>
          </div>

          <div className="flex flex-col items-center text-white">
            <Share2 size={28} fill="white" />
            <span className="text-[10px] font-bold mt-0.5">4,500</span>
          </div>

          {/* Spinning Record */}
          <div className="w-9 h-9 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center animate-spin mt-2" style={{ animation: 'spin 6s linear infinite' }}>
            <div className="w-3 h-3 rounded-full bg-black border border-slate-600" />
          </div>
        </div>

        {/* Bottom Content Overlay */}
        <div className="absolute bottom-0 w-full p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
          {/* Username & Sponsored Badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-bold text-sm text-white">@{username}</span>
            {isPromoted && (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white rounded-full animate-pulse">
                Sponsored
              </span>
            )}
          </div>

          {/* Caption */}
          <p className="text-xs text-white/90 line-clamp-2 mb-2">
            {caption}
          </p>

          {/* Music */}
          <div className="flex items-center gap-2 mb-3">
            <Music2 size={12} className="text-white" />
            <div className="overflow-hidden max-w-[180px]">
              <span className="text-[10px] text-white/80 whitespace-nowrap">
                Original Sound - {username}
              </span>
            </div>
          </div>

          {/* CTA Button */}
          {isPromoted && ctaText && (
            <button className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-lg">
              {ctaText}
            </button>
          )}
        </div>
      </div>

      {/* Phone notch/dynamic island */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full" />
    </div>
  );
};
