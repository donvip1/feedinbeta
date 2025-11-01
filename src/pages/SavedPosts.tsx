import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "@/components/feed/PostCard";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const SavedPosts = () => {
  const navigate = useNavigate();
  const [selectedCollection, setSelectedCollection] = useState('default');

  const { data: savedPosts, refetch } = useQuery({
    queryKey: ["saved-posts", selectedCollection],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("saved_posts")
        .select(`
          *,
          posts!inner (
            *,
            profiles!inner (
              display_name,
              username,
              avatar_url
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("collection_name", selectedCollection)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: collections } = useQuery({
    queryKey: ["saved-collections"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("saved_posts")
        .select("collection_name")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      // Get unique collection names
      const uniqueCollections = [...new Set(data.map(item => item.collection_name))];
      return uniqueCollections;
    },
  });

  const handleUnsave = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("user_id", user.id)
      .eq("post_id", postId);

    if (error) {
      toast.error("Failed to unsave post");
      return;
    }

    toast.success("Post removed from saved");
    refetch();
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bookmark className="w-8 h-8 text-primary" />
              Saved Posts
            </h1>
          </div>

          {collections && collections.length > 1 && (
            <Tabs value={selectedCollection} onValueChange={setSelectedCollection} className="mb-6">
              <TabsList>
                {collections.map((collection) => (
                  <TabsTrigger key={collection} value={collection}>
                    {collection}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <div className="space-y-6">
            {savedPosts && savedPosts.length > 0 ? (
              savedPosts.map((saved: any) => (
                <div key={saved.id} className="relative">
                  <PostCard
                    post={{
                      ...saved.posts,
                      profiles: saved.posts.profiles,
                    }}
                    onUpdate={() => refetch()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm"
                    onClick={() => handleUnsave(saved.posts.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-20">
                <Bookmark className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No saved posts yet</p>
                <Button 
                  className="mt-4"
                  onClick={() => navigate('/feed')}
                >
                  Explore Feed
                </Button>
              </div>
            )}
          </div>
        </div>
        <BottomNav onQuickActionClick={() => {}} />
      </div>
    </>
  );
};

export default SavedPosts;