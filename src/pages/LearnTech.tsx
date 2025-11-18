import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, BookOpen, Code, Laptop, Smartphone, Database, Cloud, Lock, TrendingUp, Clock, Users, Star, Play, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorAvatar: string;
  duration: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  category: string;
  thumbnail: string;
  enrolled: number;
  rating: number;
  lessons: number;
  isEnrolled?: boolean;
  progress?: number;
}

const techCategories = [
  { id: 'all', label: 'All Courses', icon: BookOpen },
  { id: 'web', label: 'Web Development', icon: Code },
  { id: 'mobile', label: 'Mobile Apps', icon: Smartphone },
  { id: 'data', label: 'Data Science', icon: Database },
  { id: 'cloud', label: 'Cloud Computing', icon: Cloud },
  { id: 'cyber', label: 'Cybersecurity', icon: Lock },
  { id: 'ai', label: 'AI & ML', icon: Laptop },
];

const sampleCourses: Course[] = [
  {
    id: '1',
    title: 'Complete Web Development Bootcamp',
    description: 'Master HTML, CSS, JavaScript, React, Node.js and more',
    instructor: 'Sarah Johnson',
    instructorAvatar: '',
    duration: '40 hours',
    level: 'Beginner',
    category: 'web',
    thumbnail: '',
    enrolled: 15240,
    rating: 4.8,
    lessons: 120,
  },
  {
    id: '2',
    title: 'Python for Data Science',
    description: 'Learn Python programming and data analysis fundamentals',
    instructor: 'Michael Chen',
    instructorAvatar: '',
    duration: '35 hours',
    level: 'Intermediate',
    category: 'data',
    thumbnail: '',
    enrolled: 12500,
    rating: 4.9,
    lessons: 85,
  },
  {
    id: '3',
    title: 'Mobile App Development with React Native',
    description: 'Build iOS and Android apps with React Native',
    instructor: 'Emma Davis',
    instructorAvatar: '',
    duration: '30 hours',
    level: 'Intermediate',
    category: 'mobile',
    thumbnail: '',
    enrolled: 9800,
    rating: 4.7,
    lessons: 95,
  },
  {
    id: '4',
    title: 'AWS Cloud Practitioner',
    description: 'Master Amazon Web Services fundamentals',
    instructor: 'David Wilson',
    instructorAvatar: '',
    duration: '25 hours',
    level: 'Beginner',
    category: 'cloud',
    thumbnail: '',
    enrolled: 11200,
    rating: 4.8,
    lessons: 70,
  },
  {
    id: '5',
    title: 'Ethical Hacking & Cybersecurity',
    description: 'Learn penetration testing and security practices',
    instructor: 'Alex Martinez',
    instructorAvatar: '',
    duration: '45 hours',
    level: 'Advanced',
    category: 'cyber',
    thumbnail: '',
    enrolled: 8600,
    rating: 4.9,
    lessons: 110,
  },
  {
    id: '6',
    title: 'Machine Learning A-Z',
    description: 'Complete guide to ML algorithms and applications',
    instructor: 'Dr. Lisa Brown',
    instructorAvatar: '',
    duration: '50 hours',
    level: 'Advanced',
    category: 'ai',
    thumbnail: '',
    enrolled: 13400,
    rating: 4.9,
    lessons: 130,
  },
];

export default function LearnTech() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [courses, setCourses] = useState<Course[]>(sampleCourses);
  const [enrolledCourses, setEnrolledCourses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadEnrolledCourses();
    }
  }, [user]);

  const loadEnrolledCourses = async () => {
    // In a real app, fetch from database
    // For now, use local storage
    const enrolled = localStorage.getItem(`enrolled_courses_${user?.id}`) || '[]';
    setEnrolledCourses(new Set(JSON.parse(enrolled)));
  };

  const handleEnroll = (courseId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to enroll in courses",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    const newEnrolled = new Set(enrolledCourses);
    newEnrolled.add(courseId);
    setEnrolledCourses(newEnrolled);
    localStorage.setItem(`enrolled_courses_${user.id}`, JSON.stringify(Array.from(newEnrolled)));
    
    toast({
      title: "Enrolled Successfully!",
      description: "You can now access this course anytime",
    });
  };

  const filteredCourses = courses.filter(course => {
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Intermediate': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Advanced': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate(-1)} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Learn Tech</h1>
              <p className="text-sm text-muted-foreground">Master the Skills Shaping Tomorrow</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search courses..."
            className="pl-10 bg-card border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="explore" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="explore">Explore</TabsTrigger>
            <TabsTrigger value="my-learning">My Learning</TabsTrigger>
          </TabsList>

          {/* Explore Tab */}
          <TabsContent value="explore" className="space-y-6">
            {/* Categories */}
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
              {techCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {category.label}
                  </Button>
                );
              })}
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map((course) => (
                <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-16 h-16 text-primary/50" />
                    </div>
                    <Badge className={`absolute top-2 right-2 ${getLevelColor(course.level)}`}>
                      {course.level}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback>{course.instructor[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{course.instructor}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {course.duration}
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {course.lessons} lessons
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        <span className="font-semibold">{course.rating}</span>
                        <span className="text-xs text-muted-foreground">({course.enrolled.toLocaleString()})</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-4 h-4" />
                        {course.enrolled.toLocaleString()}
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleEnroll(course.id)}
                      disabled={enrolledCourses.has(course.id)}
                    >
                      {enrolledCourses.has(course.id) ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Enrolled
                        </>
                      ) : (
                        'Enroll Now'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* My Learning Tab */}
          <TabsContent value="my-learning" className="space-y-6">
            {user ? (
              enrolledCourses.size > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courses.filter(c => enrolledCourses.has(c.id)).map((course) => (
                    <Card key={course.id} className="overflow-hidden">
                      <CardHeader>
                        <CardTitle>{course.title}</CardTitle>
                        <CardDescription>Continue your learning journey</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">0%</span>
                          </div>
                          <Progress value={0} className="h-2" />
                        </div>
                        <Button className="w-full">
                          <Play className="w-4 h-4 mr-2" />
                          Continue Learning
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
                    <p className="text-muted-foreground mb-4">Start learning by enrolling in a course</p>
                    <Button onClick={() => {
                      const exploreTab = document.querySelector('[value="explore"]') as HTMLElement;
                      exploreTab?.click();
                    }}>
                      Explore Courses
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Sign in to track your progress</h3>
                  <p className="text-muted-foreground mb-4">Create an account to enroll in courses and track your learning</p>
                  <Button onClick={() => navigate('/auth')}>
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
