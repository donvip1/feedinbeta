import { useState, useEffect, useRef, useMemo } from "react";
import { Send, Heart, ChevronDown, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatTextWithHashtagsAndMentions } from "@/lib/text-formatting-utils";

interface InlineCommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  onCommentAdded?: () => void;
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

export default function InlineCommentsPanel({ 
  isOpen, 
  onClose, 
  postId, 
  onCommentAdded 
}: InlineCommentsPanelProps) {
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
  const optimisticallyAddedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    fetchComments();
    fetchUsers();

    // Real-time subscription for comments
    const channel = supabase
      .channel(`inline-comments:${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        (payload) => {
          const newRow = payload.new as CommentRow;
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
          const updatedRow = payload.new as CommentRow;
          mergeUpdatedComment(updatedRow);
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
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          ),
          comment_likes (count)
        `)
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
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            username,
            avatar_url
          ),
          comment_likes (count)
        `)
        .single();

      if (insertError) throw insertError;

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
      onCommentAdded?.();
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
        updateLikeCount(commentId, -1);
      } else {
        await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: user.id,
        });
        updateLikeCount(commentId, +1);
      }
    } catch (error) {
      console.error("Error liking comment:", error);
    }
  };

  function mergeInsertedComment(row: CommentRow) {
    setComments((prev) => {
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

  const handleNavigateToProfile = (username: string | null, userId: string) => {
    onClose();
    navigate(`/profile/${username || userId}`);
  };

  if (!isOpen) return null;

  const topLevelCount = comments.length;

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm rounded-t-3xl flex flex-col z-50 animate-in slide-in-from-bottom duration-300"
      style={{ height: '45%', maxHeight: '45vh' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with drag handle */}
      <div className="flex-shrink-0 pt-2 pb-3 px-4">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Comments ({topLevelCount})</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="w-4 h-4" />
            Hide
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 px-4">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No comments yet</p>
            <p className="text-xs">Be the first to comment</p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {comments.map((c) => (
              <div key={c.id} className="space-y-2">
                {/* Main comment */}
                <div className="flex gap-2.5 group">
                  <Avatar
                    className="w-8 h-8 flex-shrink-0 cursor-pointer"
                    onClick={() => handleNavigateToProfile(c.profiles?.username || null, c.user_id)}
                  >
                    <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{c.profiles?.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className="text-xs font-semibold cursor-pointer hover:underline"
                        onClick={() => handleNavigateToProfile(c.profiles?.username || null, c.user_id)}
                      >
                        {c.profiles?.display_name}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed break-words mb-1">
                      {formatTextWithHashtagsAndMentions(c.content).map((part: any) => {
                        if (part.type === "hashtag") {
                          return (
                            <span
                              key={part.key}
                              className="text-primary cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
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
                                onClose();
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
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLikeComment(c.id)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Heart className="w-3 h-3" />
                        <span>{c.comment_likes?.[0]?.count || 0}</span>
                      </button>
                      <button
                        onClick={() => setReplyTo({ id: c.id, username: c.profiles?.display_name || "User" })}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-medium"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {c.replies && c.replies.length > 0 && (
                  <div className="ml-10 space-y-2 border-l-2 border-border pl-3">
                    {c.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-2 group">
                        <Avatar
                          className="w-6 h-6 flex-shrink-0 cursor-pointer"
                          onClick={() => handleNavigateToProfile(reply.profiles?.username || null, reply.user_id)}
                        >
                          <AvatarImage src={reply.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{reply.profiles?.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p
                              className="text-xs font-semibold cursor-pointer hover:underline"
                              onClick={() => handleNavigateToProfile(reply.profiles?.username || null, reply.user_id)}
                            >
                              {reply.profiles?.display_name}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed break-words">
                            {formatTextWithHashtagsAndMentions(reply.content).map((part: any) => {
                              if (part.type === "hashtag") {
                                return (
                                  <span
                                    key={part.key}
                                    className="text-primary cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onClose();
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
                                      onClose();
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
                          <div className="flex items-center gap-3 mt-1">
                            <button
                              onClick={() => handleLikeComment(reply.id)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Heart className="w-2.5 h-2.5" />
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

      {/* Mention suggestions */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-20 left-4 right-4 max-h-32 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-60">
          {filteredUsers.slice(0, 5).map((u) => (
            <button
              key={u.id}
              onClick={() => insertMention(u)}
              className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 text-left"
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">{u.display_name?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium">{u.display_name}</p>
                <p className="text-[10px] text-muted-foreground">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/50 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Replying to <span className="font-medium text-foreground">{replyTo.username}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="h-6 text-xs">
            Cancel
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-background">
        <div className="flex items-center gap-2">
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={handleInputChange}
            placeholder={replyTo ? `Reply to ${replyTo.username}...` : "Add a comment..."}
            className="flex-1 bg-muted/50 rounded-full px-4 py-2.5 text-sm resize-none max-h-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!comment.trim() || isLoading}
            className="rounded-full h-10 w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
