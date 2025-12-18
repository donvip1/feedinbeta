import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Repeat, Quote, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface RefeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  post?: any;
  onRefeedAdded?: () => void;
}

export default function RefeedModal({ isOpen, onClose, postId, post, onRefeedAdded }: RefeedModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showQuoteComposer, setShowQuoteComposer] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const handleRefeed = async () => {
    if (!user) return;

    try {
      // Check if already refeeded
      const { data: existing, error: existingError } = await supabase
        .from("post_shares")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .eq("share_type", "refeed")
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        toast({
          title: "Already refeeded",
          description: "You have already shared this post",
        });
        onClose();
        return;
      }

      // Create a refeed post - DO NOT copy media, just reference original
      const { error: postError } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          original_post_id: postId,
          post_type: "refeed",
          status: "active",
          content: null, // No content for simple refeed
          media_url: null, // Don't duplicate media
          media_type: null,
        },
      ]);

      if (postError) throw postError;

      // Insert share record - trigger automatically updates refeeds_count
      const { error: shareError } = await supabase.from("post_shares").insert([
        {
          post_id: postId,
          user_id: user.id,
          share_type: "refeed",
        },
      ]);
      if (shareError) throw shareError;

      toast({
        title: "Refeeded!",
        description: "Post shared to your feed",
      });
      onRefeedAdded?.();
      onClose();
    } catch (error) {
      console.error("Refeed error:", error);
      toast({
        title: "Error refeeding post",
        variant: "destructive",
      });
    }
  };

  const handleQuoteRefeed = async () => {
    if (!user || !quoteText.trim()) return;

    setIsPosting(true);
    try {
      // Create new post with quote - DO NOT copy media, just reference original
      const { error: insertError } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          content: quoteText.trim(),
          original_post_id: postId,
          post_type: "quote",
          status: "active",
          media_url: null, // Don't duplicate media
          media_type: null,
        },
      ]);

      if (insertError) throw insertError;

      // Insert share record - trigger automatically updates refeeds_count
      const { error: shareError } = await supabase.from("post_shares").insert([
        {
          post_id: postId,
          user_id: user.id,
          share_type: "quote",
        },
      ]);
      if (shareError) throw shareError;

      toast({
        title: "Quote posted!",
        description: "Your quote has been shared",
      });
      onRefeedAdded?.();
      onClose();
      setShowQuoteComposer(false);
      setQuoteText("");
    } catch (error: any) {
      console.error("Error posting quote:", error);
      toast({
        title: "Error posting quote",
        description: error.message || "Failed to post quote",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const resetAndClose = () => {
    setShowQuoteComposer(false);
    setQuoteText("");
    onClose();
  };

  if (showQuoteComposer) {
    return (
      <Sheet open={isOpen} onOpenChange={resetAndClose}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-3xl">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Button variant="ghost" size="icon" onClick={() => setShowQuoteComposer(false)}>
                <X className="w-5 h-5" />
              </Button>
              <h2 className="text-lg font-semibold">Quote</h2>
              <Button 
                onClick={handleQuoteRefeed} 
                disabled={isPosting || !quoteText.trim()} 
                className="rounded-full px-5"
                size="sm"
              >
                {isPosting ? "Posting..." : "Post"}
              </Button>
            </div>

            {/* Composer */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex gap-3 mb-4">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback>{user?.user_metadata?.display_name?.[0] || user?.email?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <Textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Add your comment..."
                  className="min-h-[100px] border-0 focus-visible:ring-0 resize-none text-base p-0 bg-transparent"
                  autoFocus
                />
              </div>

              {/* Quoted Post Preview - Twitter Style */}
              {post && (
                <div className="border rounded-2xl overflow-hidden bg-card">
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-5 h-5">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback className="text-[10px]">{post.profiles?.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold">{post.profiles?.display_name}</span>
                      <span className="text-xs text-muted-foreground">@{post.profiles?.username}</span>
                    </div>
                    {post.content && (
                      <p className="text-sm line-clamp-3 mb-2">{post.content}</p>
                    )}
                  </div>
                  {post.media_url && (
                    <div className="border-t">
                      {post.media_type === "video" ? (
                        <video
                          src={post.media_url}
                          className="w-full max-h-40 object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img src={post.media_url} alt="Post" className="w-full max-h-40 object-cover" />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={resetAndClose}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-8">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-4" />
        <div className="space-y-1 px-4">
          <Button
            onClick={handleRefeed}
            className="w-full flex items-center justify-start gap-3 h-14 rounded-xl"
            variant="ghost"
          >
            <div className="p-2 bg-muted rounded-full">
              <Repeat className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="font-semibold block">Refeed</span>
              <span className="text-xs text-muted-foreground">Share to your followers</span>
            </div>
          </Button>

          <Button
            onClick={() => setShowQuoteComposer(true)}
            className="w-full flex items-center justify-start gap-3 h-14 rounded-xl"
            variant="ghost"
          >
            <div className="p-2 bg-muted rounded-full">
              <Quote className="w-5 h-5" />
            </div>
            <div className="text-left">
              <span className="font-semibold block">Quote</span>
              <span className="text-xs text-muted-foreground">Add your thoughts</span>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
