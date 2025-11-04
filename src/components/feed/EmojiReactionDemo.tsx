import { Card } from "@/components/ui/card";
import { Smile, Heart, MessageCircle } from "lucide-react";

export const EmojiReactionDemo = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Smile className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold">New: Emoji Reactions!</h3>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Express yourself with emoji reactions on comments:</p>
          
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <span className="font-medium">Tap the 😊 button</span> next to any comment
            </li>
            <li>
              <span className="font-medium">Choose from 20 reactions</span> - ❤️ 😂 😮 🔥 and more
            </li>
            <li>
              <span className="font-medium">See who reacted</span> - hover over reactions to view users
            </li>
            <li>
              <span className="font-medium">Toggle reactions</span> - tap again to remove your reaction
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <MessageCircle className="w-4 h-4" />
          <span>Reactions appear below comment actions</span>
        </div>
      </div>
    </Card>
  );
};