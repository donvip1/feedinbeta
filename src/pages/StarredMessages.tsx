import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStarredMessages, StarredMessage } from '@/hooks/useStarredMessages';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Star, Image, Video, FileText, Mic, Users, MessageCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const StarredMessages = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { starredMessages, loading, toggleStar } = useStarredMessages();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const groupedMessages = starredMessages.reduce<Record<string, StarredMessage[]>>((acc, msg) => {
    const key = msg.messageType === 'group'
      ? `group:${msg.groupId}:${msg.groupName || 'Group'}`
      : `dm:${msg.conversationId}:${msg.conversationPartnerName || 'Chat'}`;
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  const getMediaIcon = (mediaType?: string) => {
    if (!mediaType) return null;
    if (mediaType.includes('image')) return <Image className="w-4 h-4 text-blue-500" />;
    if (mediaType.includes('video')) return <Video className="w-4 h-4 text-purple-500" />;
    if (mediaType.includes('audio')) return <Mic className="w-4 h-4 text-green-500" />;
    return <FileText className="w-4 h-4 text-orange-500" />;
  };

  const handleMessageClick = (msg: StarredMessage) => {
    if (msg.messageType === 'group' && msg.groupId) {
      navigate(`/groups/${msg.groupId}/chat`);
    } else if (msg.conversationId) {
      navigate(`/messages/${msg.conversationId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h1 className="text-xl font-bold">Starred Messages</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Star className="w-16 h-16 mb-4 opacity-30" />
            <h2 className="text-lg font-medium mb-2">No starred messages</h2>
            <p className="text-sm text-center">
              Tap the star icon on any message to save it here for quick access.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="space-y-6">
              {Object.entries(groupedMessages).map(([key, messages]) => {
                const [type, id, name] = key.split(':');
                const isGroup = type === 'group';

                return (
                  <Card key={key} className="p-4 bg-card/50">
                    <div className="flex items-center gap-2 mb-4">
                      {isGroup ? (
                        <Users className="w-4 h-4 text-primary" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-primary" />
                      )}
                      <h3 className="font-medium text-sm">{name}</h3>
                    </div>

                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <button
                          key={msg.id}
                          onClick={() => handleMessageClick(msg)}
                          className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={msg.senderAvatar} />
                              <AvatarFallback className="text-xs">
                                {msg.senderName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{msg.senderName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(msg.createdAt), 'MMM d, yyyy')}
                                </span>
                              </div>

                              {msg.mediaUrl ? (
                                <div className="flex items-center gap-2">
                                  {getMediaIcon(msg.mediaType)}
                                  <span className="text-sm text-muted-foreground">
                                    {msg.content || 'Media'}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm line-clamp-2">{msg.content}</p>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStar(
                                  msg.messageId,
                                  msg.messageType,
                                  msg.conversationId,
                                  msg.groupId
                                );
                              }}
                              className="shrink-0 p-1"
                            >
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default StarredMessages;
