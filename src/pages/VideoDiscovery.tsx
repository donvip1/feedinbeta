import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Play, Clock, Eye, Filter, ChevronRight,
  Bookmark, BookmarkCheck, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const VideoDiscovery = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedVideos, setSavedVideos] = useState<Set<string>>(new Set());

  const categories = [
    { id: 'programming', name: 'Programming', icon: '💻' },
    { id: 'design', name: 'Design', icon: '🎨' },
    { id: 'business', name: 'Business', icon: '📊' },
    { id: 'science', name: 'Science', icon: '🔬' },
    { id: 'languages', name: 'Languages', icon: '🌍' },
    { id: 'music', name: 'Music', icon: '🎵' },
  ];

  const trendingVideos = [
    {
      id: '1',
      title: 'Learn React in 1 Hour - Complete Beginner Tutorial',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
      channel: 'CodeMaster',
      views: '1.2M',
      duration: '1:02:34',
      category: 'programming',
    },
    {
      id: '2',
      title: 'UI/UX Design Fundamentals - From Zero to Hero',
      thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400',
      channel: 'Design Pro',
      views: '856K',
      duration: '45:20',
      category: 'design',
    },
    {
      id: '3',
      title: 'Python for Data Science - Complete Course',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400',
      channel: 'DataWiz',
      views: '2.1M',
      duration: '2:15:00',
      category: 'programming',
    },
    {
      id: '4',
      title: 'Business Strategy Fundamentals',
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      channel: 'BizAcademy',
      views: '423K',
      duration: '38:45',
      category: 'business',
    },
  ];

  const toggleSave = (videoId: string) => {
    setSavedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
        toast.success('Removed from saved');
      } else {
        newSet.add(videoId);
        toast.success('Added to saved');
      }
      return newSet;
    });
  };

  const VideoCard = ({ video }: { video: typeof trendingVideos[0] }) => (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-muted">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-white text-xs">
          {video.duration}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/40">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>
      <CardContent className="p-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => toggleSave(video.id)}
          >
            {savedVideos.has(video.id) ? (
              <BookmarkCheck className="w-4 h-4 text-primary" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{video.channel}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <Eye className="w-3 h-3" />
          <span>{video.views} views</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Video Discovery" onBack={() => navigate('/ai/learn')} />
      
      <div className="p-4 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search educational videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Categories */}
        <div>
          <h2 className="font-semibold mb-3">Browse by Category</h2>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant="outline"
                className="h-auto py-3 flex-col gap-1"
                onClick={() => navigate(`/ai/learn/videos/${cat.id}`)}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-xs">{cat.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Trending Videos */}
        <Tabs defaultValue="trending">
          <TabsList className="w-full">
            <TabsTrigger value="trending" className="flex-1">
              <TrendingUp className="w-4 h-4 mr-1" /> Trending
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1">
              <Bookmark className="w-4 h-4 mr-1" /> Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {trendingVideos.map((video, index) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <VideoCard video={video} />
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            {savedVideos.size === 0 ? (
              <div className="text-center py-12">
                <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No saved videos yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Save videos to watch them later
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {trendingVideos
                  .filter(v => savedVideos.has(v.id))
                  .map((video, index) => (
                    <motion.div
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <VideoCard video={video} />
                    </motion.div>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VideoDiscovery;
