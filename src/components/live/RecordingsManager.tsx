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
  Video, 
  Play, 
  CheckSquare, 
  Square, 
  AlertTriangle,
  Clock,
  Users,
  X
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

interface Recording {
  id: string;
  title: string;
  description: string | null;
  recording_url: string;
  ended_at: string;
  started_at: string | null;
  peak_viewers: number | null;
  viewer_count: number | null;
  type: 'space' | 'stream';
}

interface RecordingsManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RecordingsManager = ({ isOpen, onClose }: RecordingsManagerProps) => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'selected' | 'all' | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchRecordings();
    }
  }, [isOpen, user]);

  const fetchRecordings = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch space recordings
      const { data: spaces, error: spacesError } = await supabase
        .from('live_spaces')
        .select('id, title, description, recording_url, ended_at, started_at, peak_viewers, viewer_count')
        .eq('user_id', user.id)
        .eq('status', 'ended')
        .not('recording_url', 'is', null)
        .order('ended_at', { ascending: false });

      if (spacesError) throw spacesError;

      // Fetch stream recordings (if applicable)
      const { data: streams, error: streamsError } = await supabase
        .from('live_streams')
        .select('id, title, description, ended_at, started_at, peak_viewers, viewer_count')
        .eq('user_id', user.id)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false });

      if (streamsError) throw streamsError;

      const spaceRecordings: Recording[] = (spaces || []).map(s => ({
        ...s,
        type: 'space' as const,
      }));

      // Note: streams may not have recording_url yet, but we include them for future
      const streamRecordings: Recording[] = (streams || [])
        .filter((s: any) => s.recording_url) // Only include if has recording
        .map((s: any) => ({
          ...s,
          type: 'stream' as const,
        }));

      setRecordings([...spaceRecordings, ...streamRecordings].sort((a, b) => 
        new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime()
      ));
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('Failed to load recordings');
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
    if (selectedIds.size === recordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map(r => r.id)));
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
        ? recordings.map(r => r.id)
        : Array.from(selectedIds);

      // Separate by type
      const spaceIds = recordings
        .filter(r => idsToDelete.includes(r.id) && r.type === 'space')
        .map(r => r.id);
      
      const streamIds = recordings
        .filter(r => idsToDelete.includes(r.id) && r.type === 'stream')
        .map(r => r.id);

      // Delete space recordings (set recording_url to null)
      if (spaceIds.length > 0) {
        const { error: spaceError } = await supabase
          .from('live_spaces')
          .update({ recording_url: null })
          .in('id', spaceIds)
          .eq('user_id', user.id);

        if (spaceError) throw spaceError;
      }

      // Delete stream recordings (set recording_url to null if exists)
      if (streamIds.length > 0) {
        // Note: live_streams might not have recording_url column yet
        // This is a placeholder for when it's added
        console.log('Stream recordings to delete:', streamIds);
      }

      toast.success(`Deleted ${idsToDelete.length} recording(s)`);
      setSelectedIds(new Set());
      await fetchRecordings();
    } catch (error) {
      console.error('Error deleting recordings:', error);
      toast.error('Failed to delete recordings');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const formatDuration = (startedAt: string | null, endedAt: string) => {
    if (!startedAt) return 'Unknown';
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Manage Recordings
            </DialogTitle>
          </DialogHeader>

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-2 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={recordings.length === 0}
              >
                {selectedIds.size === recordings.length && recordings.length > 0 ? (
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
                  Delete Selected
                </Button>
              )}
              {recordings.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteClick('all')}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete All
                </Button>
              )}
            </div>
          </div>

          {/* Recordings List */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mb-4 opacity-50" />
                <p>No recordings found</p>
                <p className="text-sm">Your recorded live spaces will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                {recordings.map((recording) => (
                  <Card
                    key={recording.id}
                    className={cn(
                      "p-4 transition-all cursor-pointer hover:bg-secondary/50",
                      selectedIds.has(recording.id) && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => toggleSelection(recording.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(recording.id)}
                        onCheckedChange={() => toggleSelection(recording.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {recording.type === 'space' ? (
                            <Radio className="w-4 h-4 text-primary" />
                          ) : (
                            <Video className="w-4 h-4 text-primary" />
                          )}
                          <h4 className="font-medium truncate">{recording.title}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {recording.type === 'space' ? 'Space' : 'Stream'}
                          </Badge>
                        </div>
                        {recording.description && (
                          <p className="text-sm text-muted-foreground truncate mb-2">
                            {recording.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(recording.started_at, recording.ended_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {recording.peak_viewers || recording.viewer_count || 0} viewers
                          </span>
                          <span>
                            {format(new Date(recording.ended_at), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(recording.recording_url, '_blank');
                        }}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete {deleteTarget === 'all' ? 'All' : 'Selected'} Recordings?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget === 'all' ? recordings.length : selectedIds.size} recording(s). 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
