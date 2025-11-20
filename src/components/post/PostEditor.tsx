interface PostEditorProps {
  media: { url: string; type: 'image' | 'video' };
  onRetake: () => void;
  onNext: () => void;
}

export default function PostEditor({ media, onRetake, onNext }: PostEditorProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto">
      <div className="w-full mb-4">
        {media.type === 'image' ? (
          <img src={media.url} className="w-full rounded-lg object-cover max-h-64" alt="Preview" />
        ) : (
          <video src={media.url} className="w-full rounded-lg max-h-64" controls />
        )}
      </div>

      <div className="w-full flex justify-between mt-6">
        <button onClick={onRetake} className="px-4 py-2 rounded-full bg-muted">
          Retake
        </button>
        <button onClick={onNext} className="px-4 py-2 rounded-full bg-primary text-white">
          Next
        </button>
      </div>
    </div>
  );
}
