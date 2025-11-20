import { useState } from 'react';
import { X } from 'lucide-react';

interface PostEditorProps {
  media: { url: string; type: 'image' | 'video'; file: File };
  onRetake: () => void;
  onNext: (editedMedia: { url: string; type: 'image' | 'video'; file: File }) => void;
}

const filters = [
  { name: 'Normal', filter: 'none' },
  { name: 'Bright', filter: 'brightness(1.2)' },
  { name: 'Dark', filter: 'brightness(0.8)' },
  { name: 'Contrast', filter: 'contrast(1.3)' },
  { name: 'Warm', filter: 'sepia(0.3)' },
  { name: 'Cool', filter: 'hue-rotate(180deg)' },
];

export default function PostEditor({ media, onRetake, onNext }: PostEditorProps) {
  const [selectedFilter, setSelectedFilter] = useState('none');

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-start p-4 overflow-y-auto max-w-sm mx-auto">
      <div className="w-full flex items-center justify-between mb-4">
        <button onClick={onRetake} className="text-foreground">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold">Edit</h2>
        <div className="w-6" />
      </div>

      <div className="w-full mb-4" style={{ filter: selectedFilter }}>
        {media.type === 'image' ? (
          <img src={media.url} className="w-full rounded-lg object-cover max-h-96" alt="Preview" />
        ) : (
          <video src={media.url} className="w-full rounded-lg max-h-96" controls />
        )}
      </div>

      <div className="w-full mb-6">
        <h3 className="text-sm font-medium mb-3">Filters</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.name}
              onClick={() => setSelectedFilter(filter.filter)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                selectedFilter === filter.filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {filter.name}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full flex gap-3">
        <button
          onClick={onRetake}
          className="flex-1 py-3 rounded-full bg-muted text-foreground font-semibold"
        >
          Retake
        </button>
        <button
          onClick={() => onNext(media)}
          className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold"
        >
          Next
        </button>
      </div>
    </div>
  );
}
