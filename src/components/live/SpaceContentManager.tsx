import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trash2, 
  Radio, 
  MessageCircle,
  Gift,
  Heart,
  Users,
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SpaceWithStats {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ended_at: string | null;
  started_at: string | null;
  recording_url: string | null;
  messageCount: number;
  giftCount: number;
  reactionCount: number;
  speakerCount: number;
}

interface SpaceContentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export const SpaceContentManager = ({ isOpen, onClose, onDeleted }: SpaceContentManagerProps) => {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<SpaceWithStats[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | null>(null);
  const [deleteOptions, setDeleteOptions] = useState({
    messages: true,
    reactions: true,
    speakers: true,
    recordings: false,
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchSpaces();
    }
  }, [isOpen, user]);

  const fetchSpaces = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch ended spaces owned by user
      const { data: spacesData, error: spacesError } = await supabase
        .from('live_spaces')
        .select('id, title, description, status, ended_at, started_at, recording_url')
        .eq('user_id', user.id)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false });

      if (spacesError) throw spacesError;

      if (!spacesData || spacesData.length === 0) {
        setSpaces([]);
        setLoading(false);
        return;
      }

      // Get content counts for each space
      const spaceIds = spacesData.map(s => s.id);

      const [messagesRes, giftsRes, reactionsRes, speakersRes] = await Promise.all([
        supabase
          .from('live_space_messages')
          .select('space_id', { count: 'exact' })
          .in('space_id', spaceIds),
        supabase
          .from('live_space_gifts')
          .select('space_id', { count: 'exact' })
          .in('space_id', spaceIds),
        supabase
          .from('live_space_reactions')
          .select('space_id', { count: 'exact' })
          .in('space_id', spaceIds),
        supabase
          .from('live_space_speakers')
          .select('space_id', { count: 'exact' })
          .in('space_id', spaceIds),
      ]);

      // Count per space
      const countBySpace = (data: any[] | null, spaceId: string) => 
        data?.filter(d => d.space_id === spaceId).length || 0;

      const spacesWithStats: SpaceWithStats[] = spacesData.map(space => ({
        ...space,
        messageCount: countBySpace(messagesRes.data, space.id),
        giftCount: countBySpace(giftsRes.data, space.id),
        reactionCount: countBySpace(reactionsRes.data, space.id),
        speakerCount: countBySpace(speakersRes.data, space.id),
      }));

      setSpaces(spacesWithStats);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === spaces.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(spaces.map(s => s.id)));
    }
  };

  const handleDeleteClick = (target: 'selected' | 'all') => {
    setDeleteTarget(target);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!user) return;
    setDeleting(true);

    try {
      const idsToDelete = deleteTarget === 'all' 
        ? spaces.map(s => s.id)
        : Array.from(selectedIds);

      if (idsToDelete.length === 0) {
        toast.error('No spaces selected');
        return;
      }

      console.log('[SpaceContentManager] Starting deletion for spaces:', idsToDelete);

      const errors: string[] = [];
      const deletedCounts: Record<string, number> = {};

      // Delete messages - process each space individually for better RLS compliance
      if (deleteOptions.messages) {
        let totalDeleted = 0;
        for (const spaceId of idsToDelete) {
          const { data, error } = await supabase
            .from('live_space_messages')
            .delete()
            .eq('space_id', spaceId)
            .select('id');
          
          if (error) {
            console.error(`[SpaceContentManager] Error deleting messages for space ${spaceId}:`, error);
            errors.push(`messages (${spaceId}): ${error.message}`);
          } else {
            totalDeleted += data?.length || 0;
            console.log(`[SpaceContentManager] Deleted ${data?.length || 0} messages from space ${spaceId}`);
          }
        }
        if (totalDeleted > 0) deletedCounts['messages'] = totalDeleted;
      }

      // Delete reactions - process each space individually
      if (deleteOptions.reactions) {
        let totalDeleted = 0;
        for (const spaceId of idsToDelete) {
          const { data, error } = await supabase
            .from('live_space_reactions')
            .delete()
            .eq('space_id', spaceId)
            .select('id');
          
          if (error) {
            console.error(`[SpaceContentManager] Error deleting reactions for space ${spaceId}:`, error);
            errors.push(`reactions (${spaceId}): ${error.message}`);
          } else {
            totalDeleted += data?.length || 0;
            console.log(`[SpaceContentManager] Deleted ${data?.length || 0} reactions from space ${spaceId}`);
          }
        }
        if (totalDeleted > 0) deletedCounts['reactions'] = totalDeleted;
      }

      // Note: Gifts are intentionally NOT deleted to preserve transaction history
      // Users' received/sent gifts remain in their accounts

      // Delete speaker records - process each space individually
      if (deleteOptions.speakers) {
        let totalDeleted = 0;
        for (const spaceId of idsToDelete) {
          const { data, error } = await supabase
            .from('live_space_speakers')
            .delete()
            .eq('space_id', spaceId)
            .select('id');
          
          if (error) {
            console.error(`[SpaceContentManager] Error deleting speakers for space ${spaceId}:`, error);
            errors.push(`speakers (${spaceId}): ${error.message}`);
          } else {
            totalDeleted += data?.length || 0;
            console.log(`[SpaceContentManager] Deleted ${data?.length || 0} speaker records from space ${spaceId}`);
          }
        }
        if (totalDeleted > 0) deletedCounts['speaker records'] = totalDeleted;
      }

      // Clear recordings
      if (deleteOptions.recordings) {
        const { data, error } = await supabase
          .from('live_spaces')
          .update({ recording_url: null })
          .in('id', idsToDelete)
          .eq('user_id', user.id)
          .select('id');
        
        if (error) {
          console.error('[SpaceContentManager] Error clearing recordings:', error);
          errors.push(`recordings: ${error.message}`);
        } else if (data && data.length > 0) {
          deletedCounts['recordings'] = data.length;
          console.log(`[SpaceContentManager] Cleared ${data.length} recordings`);
        }
      }

      if (errors.length > 0) {
        console.error('[SpaceContentManager] Deletion errors:', errors);
        toast.error(`Some deletions failed. Check console for details.`);
      }
      
      const deletedSummary = Object.entries(deletedCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      
      if (deletedSummary) {
        toast.success(`Successfully deleted: ${deletedSummary}`);
      } else if (errors.length === 0) {
        toast.info('No content found to delete');
      }
      
      setSelectedIds(new Set());
      await fetchSpaces();
      onDeleted?.();
    } catch (error) {
      console.error('[SpaceContentManager] Error deleting content:', error);
      toast.error('Failed to delete content');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const formatDuration = (startedAt: string | null, endedAt: string | null) => {
    if (!startedAt || !endedAt) return 'Unknown';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const getTotalContentCount = (space: SpaceWithStats) => 
    space.messageCount + space.giftCount + space.reactionCount;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              Manage Space Content
            </DialogTitle>
          </DialogHeader>

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-2 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={spaces.length === 0}
              >
                {selectedIds.size === spaces.length && spaces.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 mr-1" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-1" />
                    Select All
                  </>
                )}
              </Button>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">{selectedIds.size} selected</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick('selected')}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Content
                </Button>
              )}
              {spaces.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick('all')}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete All Content
                </Button>
              )}
            </div>
          </div>

          {/* Spaces List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : spaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Radio className="w-12 h-12 mb-4 opacity-50" />
                <p>No ended spaces found</p>
                <p className="text-sm">Your ended live spaces will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {spaces.map((space) => (
                  <Card
                    key={space.id}
                    className={cn(
                      "p-4 transition-all cursor-pointer hover:bg-secondary/50",
                      selectedIds.has(space.id) && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => toggleSelection(space.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(space.id)}
                        onCheckedChange={() => toggleSelection(space.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Radio className="w-4 h-4 text-primary" />
                          <h4 className="font-medium truncate">{space.title}</h4>
                        </div>
                        {space.description && (
                          <p className="text-sm text-muted-foreground truncate mb-2">
                            {space.description}
                          </p>
                        )}
                        
                        {/* Content Stats */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {space.messageCount} messages
                          </span>
                          <span className="flex items-center gap-1">
                            <Gift className="w-3 h-3" />
                            {space.giftCount} gifts
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {space.reactionCount} reactions
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {space.speakerCount} participants
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(space.started_at, space.ended_at)}
                          </span>
                          {space.ended_at && (
                            <span>
                              {format(new Date(space.ended_at), 'MMM dd, yyyy')}
                            </span>
                          )}
                          {space.recording_url && (
                            <Badge variant="secondary" className="text-[10px]">
                              Has Recording
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {getTotalContentCount(space)} items
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog with Options */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Space Content
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select what content to delete from {deleteTarget === 'all' ? spaces.length : selectedIds.size} space(s). 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Delete Options */}
          <div className="space-y-3 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-messages" 
                checked={deleteOptions.messages}
                onCheckedChange={(checked) => setDeleteOptions(prev => ({ ...prev, messages: !!checked }))}
              />
              <label htmlFor="delete-messages" className="text-sm flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Chat Messages
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-reactions" 
                checked={deleteOptions.reactions}
                onCheckedChange={(checked) => setDeleteOptions(prev => ({ ...prev, reactions: !!checked }))}
              />
              <label htmlFor="delete-reactions" className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Reactions
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-speakers" 
                checked={deleteOptions.speakers}
                onCheckedChange={(checked) => setDeleteOptions(prev => ({ ...prev, speakers: !!checked }))}
              />
              <label htmlFor="delete-speakers" className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Speaker/Listener Records
              </label>
            </div>
            {/* Info about gifts - they are preserved */}
            <div className="flex items-center space-x-2 opacity-60">
              <Gift className="w-4 h-4 text-green-500 ml-6" />
              <span className="text-sm text-muted-foreground">
                Gifts are preserved (users keep their received/sent gifts)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="delete-recordings" 
                checked={deleteOptions.recordings}
                onCheckedChange={(checked) => setDeleteOptions(prev => ({ ...prev, recordings: !!checked }))}
              />
              <label htmlFor="delete-recordings" className="text-sm flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Recordings
              </label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting || (!deleteOptions.messages && !deleteOptions.reactions && !deleteOptions.speakers && !deleteOptions.recordings)}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Selected Content'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
