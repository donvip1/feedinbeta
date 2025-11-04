import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, Edit2 } from 'lucide-react';
import { StoryViewer } from './StoryViewer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Story {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  views_count: number;
}

interface Highlight {
  id: string;
  highlight_title: string;
  stories: Story[];
  cover_url: string;
}

export const StoryHighlights = ({ userId }: { userId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStories, setSelectedStories] = useState<string[]>([]);
  const [highlightTitle, setHighlightTitle] = useState('');
  const [userStories, setUserStories] = useState<Story[]>([]);

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  const loadHighlights = async () => {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .eq('is_highlight', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading highlights:', error);
      return;
    }

    // Group stories by highlight_title
    const grouped = data.reduce((acc, story) => {
      const title = story.highlight_title || 'Untitled';
      if (!acc[title]) {
        acc[title] = {
          id: title,
          highlight_title: title,
          stories: [],
          cover_url: story.media_url,
        };
      }
      acc[title].stories.push(story);
      return acc;
    }, {} as Record<string, Highlight>);

    setHighlights(Object.values(grouped));
  };

  const loadUserStories = async () => {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setUserStories(data);
  };

  const handleCreateHighlight = async () => {
    if (!highlightTitle || selectedStories.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please enter a title and select at least one story',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('stories')
      .update({ is_highlight: true, highlight_title: highlightTitle })
      .in('id', selectedStories);

    if (error) {
      toast({
        title: 'Error creating highlight',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Highlight created successfully' });
    setShowCreateModal(false);
    setHighlightTitle('');
    setSelectedStories([]);
    loadHighlights();
  };

  const isOwner = user?.id === userId;

  return (
    <div className="py-4">
      <ScrollArea className="w-full">
        <div className="flex gap-4 px-4">
          {isOwner && (
            <button
              onClick={() => {
                loadUserStories();
                setShowCreateModal(true);
              }}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">New</span>
            </button>
          )}

          {highlights.map((highlight) => (
            <button
              key={highlight.id}
              onClick={() => setSelectedHighlight(highlight.id)}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full border-2 border-border p-0.5">
                <Avatar className="w-full h-full">
                  <AvatarImage src={highlight.cover_url} />
                  <AvatarFallback>{highlight.highlight_title[0]}</AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs text-foreground max-w-[64px] truncate">
                {highlight.highlight_title}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>

      {selectedHighlight && (
        <StoryViewer
          userId={userId}
          allUserStories={
            highlights
              .find((h) => h.id === selectedHighlight)
              ?.stories.map((s) => ({
                userId: userId,
                stories: [s],
                hasViewed: false,
              })) || []
          }
          onClose={() => setSelectedHighlight(null)}
          onStoryChange={() => {}}
        />
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>Create Highlight</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Highlight Title</Label>
              <Input
                id="title"
                value={highlightTitle}
                onChange={(e) => setHighlightTitle(e.target.value)}
                placeholder="e.g., Summer 2024"
              />
            </div>

            <div>
              <Label>Select Stories</Label>
              <ScrollArea className="h-64 border border-border rounded-lg p-2">
                <div className="grid grid-cols-3 gap-2">
                  {userStories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => {
                        setSelectedStories((prev) =>
                          prev.includes(story.id)
                            ? prev.filter((id) => id !== story.id)
                            : [...prev, story.id]
                        );
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                        selectedStories.includes(story.id)
                          ? 'border-primary'
                          : 'border-transparent'
                      }`}
                    >
                      <img
                        src={story.media_url}
                        alt="Story"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Button onClick={handleCreateHighlight} className="w-full">
              Create Highlight
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
