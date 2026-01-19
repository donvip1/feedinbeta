import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  MessageSquare, ThumbsUp, CheckCircle, Clock, 
  Search, Filter, Plus, Send, ChevronDown, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const CourseDiscussion = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Mock data
  const discussions = [
    {
      id: '1',
      title: 'How do I handle state in nested components?',
      content: 'I\'m trying to pass state from a parent component to deeply nested children. What\'s the best approach?',
      author: {
        name: 'John Doe',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
      },
      createdAt: new Date(Date.now() - 3600000 * 2),
      upvotes: 24,
      replies: 5,
      isAnswered: true,
      isInstructorAnswer: true,
    },
    {
      id: '2',
      title: 'Best practices for useEffect cleanup?',
      content: 'When should I use cleanup functions in useEffect? Can someone explain with examples?',
      author: {
        name: 'Jane Smith',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
      },
      createdAt: new Date(Date.now() - 3600000 * 24),
      upvotes: 18,
      replies: 3,
      isAnswered: false,
      isInstructorAnswer: false,
    },
    {
      id: '3',
      title: 'Difference between useMemo and useCallback?',
      content: 'I\'m confused about when to use useMemo vs useCallback. They seem similar.',
      author: {
        name: 'Alex Johnson',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
      },
      createdAt: new Date(Date.now() - 3600000 * 48),
      upvotes: 42,
      replies: 8,
      isAnswered: true,
      isInstructorAnswer: true,
    },
  ];

  const handlePostQuestion = () => {
    if (!newQuestion.trim()) {
      toast.error('Please enter your question');
      return;
    }
    toast.success('Question posted successfully!');
    setNewQuestion('');
    setDialogOpen(false);
  };

  const handleReply = (threadId: string) => {
    if (!replyText.trim()) {
      toast.error('Please enter your reply');
      return;
    }
    toast.success('Reply posted!');
    setReplyText('');
  };

  const handleUpvote = (threadId: string) => {
    toast.success('Upvoted!');
  };

  const filteredDiscussions = discussions.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Course Discussion" onBack={() => navigate(-1)} />
      
      <div className="p-4 space-y-4">
        {/* Search and Post */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search discussions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ask a Question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="What would you like to ask about this course?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  rows={4}
                />
                <Button className="w-full" onClick={handlePostQuestion}>
                  Post Question
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button variant="outline" size="sm" className="flex-shrink-0">
            All
          </Button>
          <Button variant="ghost" size="sm" className="flex-shrink-0">
            Unanswered
          </Button>
          <Button variant="ghost" size="sm" className="flex-shrink-0">
            Most Upvoted
          </Button>
          <Button variant="ghost" size="sm" className="flex-shrink-0">
            Recent
          </Button>
        </div>

        {/* Discussion Threads */}
        <div className="space-y-3">
          {filteredDiscussions.map((thread, index) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={thread.author.avatar} />
                      <AvatarFallback>{thread.author.name[0]}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm line-clamp-2">{thread.title}</h3>
                        {thread.isAnswered && (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-500 flex-shrink-0">
                            <CheckCircle className="w-3 h-3 mr-1" /> Answered
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {thread.content}
                      </p>

                      <div className="flex items-center gap-4 mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2"
                          onClick={() => handleUpvote(thread.id)}
                        >
                          <ThumbsUp className="w-4 h-4 mr-1" /> {thread.upvotes}
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2"
                          onClick={() => setExpandedThread(expandedThread === thread.id ? null : thread.id)}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" /> {thread.replies}
                          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${
                            expandedThread === thread.id ? 'rotate-180' : ''
                          }`} />
                        </Button>

                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(thread.createdAt, { addSuffix: true })}
                        </span>
                      </div>

                      {/* Expanded Replies */}
                      {expandedThread === thread.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t space-y-4"
                        >
                          {/* Mock Replies */}
                          <div className="flex gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>I</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">Instructor</span>
                                {thread.isInstructorAnswer && (
                                  <Badge variant="secondary" className="text-xs">Instructor</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Great question! The best approach is to use Context API or a state management library like Zustand for deeply nested components.
                              </p>
                            </div>
                          </div>

                          {/* Reply Input */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Write a reply..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                            />
                            <Button size="icon" onClick={() => handleReply(thread.id)}>
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filteredDiscussions.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No discussions found</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                Start a Discussion
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseDiscussion;
