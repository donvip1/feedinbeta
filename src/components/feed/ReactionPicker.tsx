import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ReactionPickerProps {
  onSelect: (reaction: string) => void;
  children: React.ReactNode;
}

const reactions = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

export const ReactionPicker = ({ onSelect, children }: ReactionPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-gray-800 border-gray-700">
        <div className="flex space-x-1">
          {reactions.map((reaction) => (
            <Button
              key={reaction.type}
              onClick={() => onSelect(reaction.type)}
              variant="ghost"
              size="sm"
              className="h-auto p-2 hover:scale-125 transition-transform"
              title={reaction.label}
            >
              <span className="text-2xl">{reaction.emoji}</span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};