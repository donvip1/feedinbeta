import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Heart, MoreVertical, X as XIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTextWithHashtagsAndMentions } from "@/lib/text-formatting-utils";

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postData?: {
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    profiles?: {
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profiles?: Profile;
  comment_likes?: { count: number }[];
};

type CommentNode = CommentRow & { replies: CommentNode[] };

export default function CommentsModal({ isOpen, onClose, postId, postData }: CommentsModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartPos = useRef<number>(0);

  // Track IDs we have optimistically added to avoid double-appending on realtime INSERT
  const optimisticallyAddedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    // Initial load
    fetchComments();
    fetchUsers();

    // Precise realtime listeners
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const newRow = payload.new as CommentRow;
          // Ignore if we already added it optimistically
          if (optimisticallyAddedIds.current.has(newRow.id)) {
            optimisticallyAddedIds.current.delete(newRow.id);
            return;
          }
          mergeInsertedComment(newRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const newRow = payload.new as CommentRow;
          mergeUpdatedComment(newRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const oldRow = payload.old as CommentRow;
          removeCommentById(oldRow.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, postId]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .limit(50);
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select(
          `
          *,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          ),
          comment_likes (count)
        `,
        )
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const byId = new Map<string, CommentNode>();
      const top: CommentNode[] = [];

      (data || []).forEach((row: CommentRow) => {
        byId.set(row.id, { ...row, replies: [] });
      });

      (data || []).forEach((row: CommentRow) => {
        const node = byId.get(row.id)!;
        if (row.parent_comment_id) {
          const parent = byId.get(row.parent_comment_id);
          if (parent) parent.replies.push(node);
        } else {
          top.push(node);
        }
      });

      setComments(top);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    setComment(newValue);

    const textBeforeCursor = newValue.slice(0, position);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        mentionStartPos.current = lastAtIndex;
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (selectedUser: any) => {
    const beforeMention = comment.slice(0, mentionStartPos.current);
    const afterMention = comment.slice(textareaRef.current?.selectionStart || 0);
    const mentionText = `@${selectedUser.username || selectedUser.display_name} `;
    const newValue = beforeMention + mentionText + afterMention;
    setComment(newValue);
    setShowMentions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.username?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
          u.display_name?.toLowerCase().includes(mentionQuery.toLowerCase()),
      ),
    [users, mentionQuery],
  );

  const handleSubmit = async () => {
    if (!comment.trim() || !user) return;
    setIsLoading(true);

    try {
      const { data: newComment, error: insertError } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content: comment.trim(),
          parent_comment_id: replyTo?.id || null,
        })
        .select(
          `
          *,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          ),
          comment_likes (count)
        `,
        )
        .single();

      if (insertError) throw insertError;

      // If top-level, increment post count here (ensure no DB trigger duplicates this)
      if (newComment && !replyTo?.id) {
        const { error: updateError } = await supabase.rpc("increment_post_comments_count", {
          post_id: postId,
        });
        if (updateError) {
          console.error("Error updating comment count:", updateError);
        }
      }

      // Optimistic merge: add immediately and mark ID so realtime INSERT won't duplicate it
      if (newComment) {
        optimisticallyAddedIds.current.add(newComment.id);
        if (replyTo?.id) {
          setComments((prev) =>
            prev.map((parent) =>
              parent.id === replyTo.id
                ? { ...parent, replies: [{ ...(newComment as CommentRow), replies: [] }, ...(parent.replies || [])] }
                : parent,
            ),
          );
        } else {
          setComments((prev) => [{ ...(newComment as CommentRow), replies: [] }, ...prev]);
        }
      }

      toast({ title: "Comment posted!" });
      setComment("");
      setReplyTo(null);
    } catch (error) {
      console.error("Comment error:", error);
      toast({ title: "Error posting comment", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    try {
      const { data: existingLike } = await supabase
        .from("comment_likes")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase.from("comment_likes").delete().eq("id", existingLike.id);
        // Optimistically decrement
        updateLikeCount(commentId, -1);
      } else {
        await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: user.id,
        });
        // Optimistically increment
        updateLikeCount(commentId, +1);
      }
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  // ----- Local state merge helpers -----

  function mergeInsertedComment(row: CommentRow) {
    setComments((prev) => {
      // If it already exists, ignore
      const exists = prev.some((p) => p.id === row.id) || prev.some((p) => p.replies?.some((r) => r.id === row.id));
      if (exists) return prev;

      const node: CommentNode = { ...row, replies: [] };
      if (row.parent_comment_id) {
        return prev.map((p) => (p.id === row.parent_comment_id ? { ...p, replies: [node, ...p.replies] } : p));
      }
      return [node, ...prev];
    });
  }

  function mergeUpdatedComment(row: CommentRow) {
    setComments((prev) =>
      prev.map((p) => {
        if (p.id === row.id) return { ...p, ...row, replies: p.replies };
        const updatedReplies = p.replies.map((r) => (r.id === row.id ? { ...r, ...row, replies: r.replies } : r));
        return { ...p, replies: updatedReplies };
      }),
    );
  }

  function removeCommentById(id: string) {
    setComments((prev) =>
      prev.map((p) => ({ ...p, replies: p.replies.filter((r) => r.id !== id) })).filter((p) => p.id !== id),
    );
  }

  function updateLikeCount(id: string, delta: number) {
    setComments((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const count = p.comment_likes?.[0]?.count || 0;
          return { ...p, comment_likes: [{ count: Math.max(0, count + delta) }] };
        }
        const replies = p.replies.map((r) => {
          if (r.id === id) {
            const count = r.comment_likes?.[0]?.count || 0;
            return { ...r, comment_likes: [{ count: Math.max(0, count + delta) }] };
          }
          return r;
        });
        return { ...p, replies };
      }),
    );
  }

  // ----- Render -----

  const topLevelCount = comments.length;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col">
        {postData && (
          <div className="flex-shrink-0 bg-background relative border-b">
            {postData.media_url && (
              <div className="w-full h-[20vh] bg-black flex items-center justify-center overflow-hidden">
                {postData.media_type?.startsWith("video") ? (
                  <video
                    src={postData.media_url}
                    className="max-w-full max-h-full object-contain"
                    controls
                    playsInline
                    style={{ width: "40%", height: "auto" }}
                  />
                ) : (
                  <img
                    src={postData.media_url}
                    alt="Post media"
                    className="max-w-full max-h-full object-contain"
                    style={{ width: "40%", height: "auto" }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0 bg-background">
          <h2 className="text-lg font-semibold">Comments ({topLevelCount})</h2>
        </div>

        <ScrollArea className="flex-1 px-4">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p className="text-sm">No comments yet</p>
              <p className="text-xs">Be the first to comment</p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {comments.map((c) => (
                <div key={c.id} className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex gap-3 group">
                    <Avatar
                      className="w-10 h-10 flex-shrink-0 cursor-pointer"
                      onClick={() => navigate(`/profile/${c.user_id}`)}
                    >
                      <AvatarImage src={c.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{c.profiles?.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p
                          className="text-sm font-semibold cursor-pointer hover:underline"
                          onClick={() => navigate(`/profile/${c.user_id}`)}
                        >
                          {c.profiles?.display_name}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed break-words mb-2">
                        {formatTextWithHashtagsAndMentions(c.content).map((part: any) => {
                          if (part.type === "hashtag") {
                            return (
                              <span
                                key={part.key}
                                className="text-primary cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/search?q=${encodeURIComponent(part.searchTerm)}`);
                                }}
                              >
                                {part.text}
                              </span>
                            );
                          }
                          if (part.type === "mention") {
                            return (
                              <span
                                key={part.key}
                                className="text-primary cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/profile/${part.username}`);
                                }}
                              >
                                {part.text}
                              </span>
                            );
                          }
                          return <span key={part.key}>{part.text}</span>;
                        })}
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLikeComment(c.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Heart className="w-3.5 h-3.5" />
                          <span>{c.comment_likes?.[0]?.count || 0}</span>
                        </button>
                        <button
                          onClick={() => setReplyTo({ id: c.id, username: c.profiles?.display_name || "User" })}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>

                  {c.replies && c.replies.length > 0 && (
                    <div className="ml-12 space-y-3 border-l-2 border-border pl-4">
                      {c.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3 group">
                          <Avatar
                            className="w-8 h-8 flex-shrink-0 cursor-pointer"
                            onClick={() => navigate(`/profile/${reply.user_id}`)}
                          >
                            <AvatarImage src={reply.profiles?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{reply.profiles?.display_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className="text-sm font-semibold cursor-pointer hover:underline"
                                onClick={() => navigate(`/profile/${reply.user_id}`)}
                              >
                                {reply.profiles?.display_name}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed break-words mb-2">
                              {formatTextWithHashtagsAndMentions(reply.content).map((part: any) => {
                                if (part.type === "hashtag") {
                                  return (
                                    <span
                                      key={part.key}
                                      className="text-primary cursor-pointer hover:underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/search?q=${encodeURIComponent(part.searchTerm)}`);
                                      }}
                                    >
                                      {part.text}
                                    </span>
                                  );
                                }
                                if (part.type === "mention") {
                                  return (
                                    <span
                                      key={part.key}
                                      className="text-primary cursor-pointer hover:underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/profile/${part.username}`);
                                      }}
                                    >
                                      {part.text}
                                    </span>
                                  );
                                }
                                return <span key={part.key}>{part.text}</span>;
                              })}
                            </p>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleLikeComment(reply.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Heart className="w-3.5 h-3.5" />
                                <span>{reply.comment_likes?.[0]?.count || 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-3 bg-background flex-shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between mb-2 p-2 bg-muted rounded-lg">
              <span className="text-xs text-muted-foreground">Replying to {replyTo.username}</span>
              <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-6 px-2">
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          )}
          <div className="flex items-start gap-2">
            <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
              <AvatarImage src={user?.user_metadata?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{user?.user_metadata?.display_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              {showMentions && filteredUsers.length > 0 && (
                <div className="absolute bottom-full mb-2 w-full bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                  {filteredUsers.slice(0, 5).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => insertMention(u)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{u.display_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-sm font-medium">{u.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={comment}
                onChange={handleInputChange}
                placeholder="Add a comment..."
                className="w-full resize-none pr-12 min-h-[40px] max-h-[120px] rounded-2xl border-2 border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none transition-colors"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !showMentions) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !comment.trim()}
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
