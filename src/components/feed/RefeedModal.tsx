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
  hasRefeeded?: boolean;
  onRefeedAdded?: () => void;
  onUnrefeed?: () => void;
}

export default function RefeedModal({ isOpen, onClose, postId, post, hasRefeeded, onRefeedAdded, onUnrefeed }: RefeedModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showQuoteComposer, setShowQuoteComposer] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isUnrefeeding, setIsUnrefeeding] = useState(false);

  const handleUnrefeed = async () => {
    if (!user) return;
    
    setIsUnrefeeding(true);
    try {
      // 1. Delete share record
      const { error: shareError } = await supabase
        .from("post_shares")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .in("share_type", ["refeed", "quote"]);

      if (shareError) throw shareError;

      // 2. Delete the refeed post itself
      const { error: postError } = await supabase
        .from("posts")
        .delete()
        .eq("original_post_id", postId)
        .eq("user_id", user.id)
        .in("post_type", ["refeed", "quote"]);

      if (postError) throw postError;

      toast({
        title: "Removed",
        description: "Refeed has been removed from your feed",
      });
      onUnrefeed?.();
      onClose();
    } catch (error) {
      console.error("Un-refeed error:", error);
      toast({
        title: "Error removing refeed",
        variant: "destructive",
      });
    } finally {
      setIsUnrefeeding(false);
    }
  };

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

      // Create a refeed post - use null for media_type (constraint only allows image/video/photo_plus/null)
      const { error: postError } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          original_post_id: postId,
          post_type: "refeed",
          status: "active",
          content: null, // No content for simple refeed
          media_url: null, // Don't duplicate media
          media_type: null, // Must be null, image, video, or photo_plus - post_type identifies this as refeed
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
      // Create new post with quote - use null for media_type (constraint only allows image/video/photo_plus/null)
      const { error: insertError } = await supabase.from("posts").insert([
        {
          user_id: user.id,
          feed_id: crypto.randomUUID(),
          content: quoteText.trim(),
          original_post_id: postId,
          post_type: "quote",
          status: "active",
          media_url: null, // Don't duplicate media
          media_type: null, // Must be null, image, video, or photo_plus - post_type identifies this as quote
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
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-3xl z-[250]">
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
                  {/* Show media from media_url or media_urls */}
                  {(() => {
                    const mediaUrl = post.media_url || (post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : null);
                    const mediaType = post.media_type || (post.media_types && post.media_types.length > 0 ? post.media_types[0] : null);
                    
                    if (!mediaUrl) return null;
                    
                    return (
                      <div className="border-t">
                        {mediaType === "video" ? (
                          <video
                            src={mediaUrl}
                            className="w-full max-h-40 object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={mediaUrl} alt="Post" className="w-full max-h-40 object-cover" />
                        )}
                      </div>
                    );
                  })()}
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
      <SheetContent side="bottom" className="h-auto rounded-t-3xl p-0 pb-8 z-[250]">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-4" />
        <div className="space-y-1 px-4">
          {hasRefeeded ? (
            // Show undo refeed option when already refeeded
            <Button
              onClick={handleUnrefeed}
              disabled={isUnrefeeding}
              className="w-full flex items-center justify-start gap-3 h-14 rounded-xl text-destructive hover:text-destructive"
              variant="ghost"
            >
              <div className="p-2 bg-green-500/20 rounded-full">
                <Repeat className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <span className="font-semibold block">{isUnrefeeding ? "Removing..." : "Undo Refeed"}</span>
                <span className="text-xs text-muted-foreground">Remove from your feed</span>
              </div>
            </Button>
          ) : (
            // Show normal refeed option
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
          )}

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
