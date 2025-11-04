import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface CommentEmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const QUICK_REACTIONS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Wow" },
  { emoji: "😢", label: "Sad" },
  { emoji: "😡", label: "Angry" },
  { emoji: "👍", label: "Like" },
  { emoji: "👎", label: "Dislike" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💯", label: "100" },
  { emoji: "🎉", label: "Party" },
  { emoji: "👏", label: "Clap" },
  { emoji: "💪", label: "Strong" },
  { emoji: "🙏", label: "Pray" },
  { emoji: "🤔", label: "Think" },
  { emoji: "😍", label: "Heart Eyes" },
  { emoji: "🥰", label: "Loving" },
  { emoji: "😎", label: "Cool" },
  { emoji: "🤩", label: "Star Eyes" },
  { emoji: "🥳", label: "Celebrate" },
  { emoji: "😇", label: "Angel" },
];

export const CommentEmojiPicker = ({ onEmojiSelect }: CommentEmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-accent"
        >
          <Smile className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="grid grid-cols-5 gap-2">
          {QUICK_REACTIONS.map((reaction) => (
            <button
              key={reaction.emoji}
              onClick={() => handleEmojiClick(reaction.emoji)}
              className="flex items-center justify-center p-2 rounded-lg hover:bg-accent transition-colors"
              title={reaction.label}
            >
              <span className="text-2xl">{reaction.emoji}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};