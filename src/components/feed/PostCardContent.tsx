interface PostCardContentProps {
  content: string | null;
  hasMedia: boolean;
}

export const PostCardContent = ({ content, hasMedia }: PostCardContentProps) => {
  if (!content || !hasMedia) return null;

  return (
    <div className="absolute bottom-24 left-4 right-20 z-20">
      <p className="text-white text-base font-medium leading-relaxed drop-shadow-lg line-clamp-3 break-words">
        {content}
      </p>
    </div>
  );
};
