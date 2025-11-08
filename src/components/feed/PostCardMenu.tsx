import { MoreVertical, Trash2, Share2, Edit } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface PostCardMenuProps {
  canDelete: boolean;
  canEdit: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onShare: (platform: string) => void;
}

export const PostCardMenu = ({ canDelete, canEdit, onDelete, onEdit, onShare }: PostCardMenuProps) => {
  return (
    <div className="absolute top-4 right-4 z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border-2 border-white/20 hover:bg-black/60 text-white"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Post
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Post
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onShare('copy')}>
            <Share2 className="w-4 h-4 mr-2" />
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare('refeed')}>
            <Share2 className="w-4 h-4 mr-2" />
            ReFEED
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare('download')}>
            <Share2 className="w-4 h-4 mr-2" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare('whatsapp')}>
            Share to WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare('facebook')}>
            Share to Facebook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onShare('twitter')}>
            Share to Twitter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
