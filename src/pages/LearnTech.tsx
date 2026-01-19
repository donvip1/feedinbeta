import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Search, BookOpen, GraduationCap, Award, Users, 
  TrendingUp, Sparkles, Play, Filter, ChevronRight, Briefcase,
  Brain, Clock, Star, Trophy, Target, Flame, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/navigation/BottomNav';
import { CourseCard } from '@/components/learn/CourseCard';
import { CategoryCard } from '@/components/learn/CategoryCard';
import { InstructorCard } from '@/components/learn/InstructorCard';
import { CareerPathCard } from '@/components/learn/CareerPathCard';
import { LearningStats } from '@/components/learn/LearningStats';
import { CourseSearch } from '@/components/learn/CourseSearch';
import { useAuth } from '@/hooks/useAuth';
import { 
  useCategories, 
  useCourses, 
  useCareerPaths, 
  useFeaturedInstructors,
  usePlatformStats,
  useUserEnrollments,
  useLearningStats
} from '@/hooks/useLearnData';

export default function LearnTech() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Data fetching
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: featuredCourses, isLoading: loadingFeatured } = useCourses({ featured: true, limit: 6 });
  const { data: popularCourses, isLoading: loadingPopular } = useCourses({ sortBy: 'popular', limit: 8 });
  const { data: newCourses, isLoading: loadingNew } = useCourses({ sortBy: 'newest', limit: 6 });
  const { data: careerPaths, isLoading: loadingCareers } = useCareerPaths({ featured: true, limit: 6 });
  const { data: instructors, isLoading: loadingInstructors } = useFeaturedInstructors(6);
  const { data: platformStats } = usePlatformStats();
  const { data: userEnrollments, isLoading: loadingEnrollments } = useUserEnrollments();
  const { data: learningStats } = useLearningStats();

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const handleSearch = (query: string) => {
    navigate(`/ai/learn/search?q=${encodeURIComponent(query)}`);
  };

  const stats = [
    { 
      icon: BookOpen, 
      value: platformStats?.totalCourses ? `${Math.floor(platformStats.totalCourses / 100) * 100 + (platformStats.totalCourses > 100 ? 0 : platformStats.totalCourses)}+` : '10,000+', 
      label: 'Courses' 
    },
    { 
      icon: Users, 
      value: platformStats?.totalEnrollments ? `${(platformStats.totalEnrollments / 1000).toFixed(0)}K+` : '500K+', 
      label: 'Learners' 
    },
    { 
      icon: Award, 
      value: platformStats?.totalCertificates ? `${(platformStats.totalCertificates / 1000).toFixed(0)}K+` : '100K+', 
      label: 'Certificates' 
    },
    { 
      icon: GraduationCap, 
      value: platformStats?.totalInstructors ? `${platformStats.totalInstructors}+` : '1,000+', 
      label: 'Instructors' 
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
        
        {/* Floating Decorations */}
        <motion.div 
          className="absolute top-20 right-10 w-20 h-20 rounded-full bg-primary/20 blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-accent/20 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
        />

        <div className="relative z-10">
          {/* Navigation */}
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button onClick={() => navigate(-1)} variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  FeedIn Learn
                </h1>
                <p className="text-sm text-muted-foreground">Master Skills That Matter</p>
              </div>
            </div>
          </div>

          {/* Stats Banner */}
          <div className="container mx-auto px-4 pb-6">
            <div className="grid grid-cols-4 gap-2">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <stat.icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="text-lg font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="container mx-auto px-4 pb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="What do you want to learn today?"
                className="pl-12 pr-4 h-12 bg-card/80 backdrop-blur-sm border-border/50 rounded-xl text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchQuery && handleSearch(searchQuery)}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 h-12 rounded-xl p-1">
            <TabsTrigger value="explore" className="rounded-lg data-[state=active]:bg-background">
              <Sparkles className="w-4 h-4 mr-2" />
              Explore
            </TabsTrigger>
            <TabsTrigger value="my-learning" className="rounded-lg data-[state=active]:bg-background">
              <BookOpen className="w-4 h-4 mr-2" />
              My Learning
            </TabsTrigger>
            <TabsTrigger value="careers" className="rounded-lg data-[state=active]:bg-background">
              <Briefcase className="w-4 h-4 mr-2" />
              Careers
            </TabsTrigger>
          </TabsList>

          {/* Explore Tab */}
          <TabsContent value="explore" className="space-y-8 mt-6">
            {/* Categories */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Browse Categories</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/categories')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-4">
                  {loadingCategories ? (
                    Array(6).fill(0).map((_, i) => (
                      <Skeleton key={i} className="w-28 h-24 rounded-xl shrink-0" />
                    ))
                  ) : categories && categories.length > 0 ? (
                    categories.slice(0, 8).map((category) => (
                      <CategoryCard 
                        key={category.id} 
                        category={category}
                      />
                    ))
                  ) : (
                    // Fallback categories
                    ['Technology', 'Business', 'Design', 'Marketing', 'Health', 'Language'].map((name, i) => (
                      <Card key={i} className="w-28 shrink-0 cursor-pointer hover:border-primary/50 transition-colors">
                        <CardContent className="p-4 text-center">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-xs font-medium">{name}</span>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>

            {/* Featured Courses */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold">Featured Courses</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/courses?filter=featured')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {loadingFeatured ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="w-72 h-64 rounded-xl shrink-0" />
                    ))
                  ) : featuredCourses && featuredCourses.length > 0 ? (
                    featuredCourses.map((course) => (
                      <div key={course.id} className="w-72 shrink-0">
                        <CourseCard course={course} variant="featured" />
                      </div>
                    ))
                  ) : (
                    <Card className="w-full p-8 text-center">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Featured courses coming soon!</p>
                    </Card>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>

            {/* Popular Courses */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold">Most Popular</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/courses?sort=popular')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loadingPopular ? (
                  Array(6).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))
                ) : popularCourses && popularCourses.length > 0 ? (
                  popularCourses.slice(0, 6).map((course) => (
                    <CourseCard key={course.id} course={course} variant="compact" />
                  ))
                ) : (
                  <Card className="col-span-full p-8 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Popular courses coming soon!</p>
                  </Card>
                )}
              </div>
            </section>

            {/* Career Paths Preview */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold">Explore Career Paths</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('careers')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {loadingCareers ? (
                    Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="w-64 h-40 rounded-xl shrink-0" />
                    ))
                  ) : careerPaths && careerPaths.length > 0 ? (
                    careerPaths.map((path) => (
                      <div key={path.id} className="w-64 shrink-0">
                        <CareerPathCard careerPath={path} />
                      </div>
                    ))
                  ) : (
                    <Card className="w-full p-8 text-center">
                      <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Career paths coming soon!</p>
                    </Card>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>

            {/* Top Instructors */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold">Top Instructors</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/instructors')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {loadingInstructors ? (
                    Array(4).fill(0).map((_, i) => (
                      <Skeleton key={i} className="w-40 h-48 rounded-xl shrink-0" />
                    ))
                  ) : instructors && instructors.length > 0 ? (
                    instructors.map((instructor) => (
                      <div key={instructor.id} className="w-40 shrink-0">
                        <InstructorCard instructor={instructor} />
                      </div>
                    ))
                  ) : (
                    <Card className="w-full p-8 text-center">
                      <GraduationCap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Instructors coming soon!</p>
                    </Card>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>

            {/* New Courses */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  <h2 className="text-lg font-semibold">New & Noteworthy</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/courses?sort=newest')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingNew ? (
                  Array(4).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                  ))
                ) : newCourses && newCourses.length > 0 ? (
                  newCourses.slice(0, 4).map((course) => (
                    <CourseCard key={course.id} course={course} variant="horizontal" />
                  ))
                ) : (
                  <Card className="col-span-full p-8 text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">New courses coming soon!</p>
                  </Card>
                )}
              </div>
            </section>

            {/* CTA Banner */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-accent p-6 text-primary-foreground"
            >
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Become an Instructor</h3>
                <p className="text-sm opacity-90 mb-4">
                  Share your expertise and earn credits teaching others
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/ai/learn/teach')}>
                  Start Teaching <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="absolute right-4 bottom-0 opacity-20">
                <GraduationCap className="w-32 h-32" />
              </div>
            </motion.section>
          </TabsContent>

          {/* My Learning Tab */}
          <TabsContent value="my-learning" className="space-y-6 mt-6">
            {user ? (
              <>
                {/* Learning Stats */}
                <LearningStats stats={learningStats} />

                {/* Continue Learning */}
                <section>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Play className="w-5 h-5 text-primary" />
                    Continue Learning
                  </h2>
                  {loadingEnrollments ? (
                    <div className="space-y-4">
                      {Array(3).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                      ))}
                    </div>
                  ) : userEnrollments && userEnrollments.length > 0 ? (
                    <div className="space-y-4">
                      {userEnrollments.filter(e => !e.is_completed).slice(0, 5).map((enrollment) => (
                        <Card 
                          key={enrollment.id} 
                          className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/ai/learn/course/${enrollment.course?.slug}/learn`)}
                        >
                          <div className="flex gap-4">
                            <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                              <Play className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{enrollment.course?.title}</h3>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{enrollment.completed_lessons || 0}/{enrollment.total_lessons || 0} lessons</span>
                              </div>
                              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${enrollment.progress_percent || 0}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-semibold text-primary">
                                {Math.round(enrollment.progress_percent || 0)}%
                              </span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No courses in progress</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start learning something new today!
                      </p>
                      <Button onClick={() => setActiveTab('explore')}>
                        Explore Courses
                      </Button>
                    </Card>
                  )}
                </section>

                {/* Completed Courses */}
                {userEnrollments && userEnrollments.filter(e => e.is_completed).length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-500" />
                      Completed Courses
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userEnrollments.filter(e => e.is_completed).slice(0, 4).map((enrollment) => (
                        <Card 
                          key={enrollment.id} 
                          className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => navigate(`/ai/learn/course/${enrollment.course?.slug}`)}
                        >
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                              <Award className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{enrollment.course?.title}</h3>
                              <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={() => navigate('/ai/learn/certificates')}
                    >
                      View All Certificates
                    </Button>
                  </section>
                )}

                {/* Quick Actions */}
                <section>
                  <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Card 
                      className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => navigate('/ai/learn/certificates')}
                    >
                      <Award className="w-8 h-8 text-yellow-500 mb-2" />
                      <h3 className="font-medium">My Certificates</h3>
                      <p className="text-xs text-muted-foreground">View earned credentials</p>
                    </Card>
                    <Card 
                      className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => navigate('/ai/learn/aptitude')}
                    >
                      <Brain className="w-8 h-8 text-purple-500 mb-2" />
                      <h3 className="font-medium">Aptitude Tests</h3>
                      <p className="text-xs text-muted-foreground">Assess your skills</p>
                    </Card>
                    <Card 
                      className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => navigate('/ai/learn/resume')}
                    >
                      <Briefcase className="w-8 h-8 text-blue-500 mb-2" />
                      <h3 className="font-medium">Resume Builder</h3>
                      <p className="text-xs text-muted-foreground">Build your profile</p>
                    </Card>
                    <Card 
                      className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => navigate('/ai/learn/saved')}
                    >
                      <Star className="w-8 h-8 text-orange-500 mb-2" />
                      <h3 className="font-medium">Saved Courses</h3>
                      <p className="text-xs text-muted-foreground">Your wishlist</p>
                    </Card>
                  </div>
                </section>
              </>
            ) : (
              <Card className="p-8 text-center">
                <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Sign in to track your learning</h3>
                <p className="text-muted-foreground mb-4">
                  Create an account to enroll in courses, earn certificates, and track your progress
                </p>
                <Button onClick={() => navigate('/auth')}>Sign In</Button>
              </Card>
            )}
          </TabsContent>

          {/* Careers Tab */}
          <TabsContent value="careers" className="space-y-6 mt-6">
            {/* Career Tools */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Career Development Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card 
                  className="p-6 cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/aptitude')}
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Brain className="w-6 h-6 text-purple-500" />
                  </div>
                  <h3 className="font-semibold mb-1">Aptitude Tests</h3>
                  <p className="text-sm text-muted-foreground">
                    Discover your strengths and find the right career path
                  </p>
                  <Badge variant="secondary" className="mt-3">10 credits</Badge>
                </Card>

                <Card 
                  className="p-6 cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/resume')}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Briefcase className="w-6 h-6 text-blue-500" />
                  </div>
                  <h3 className="font-semibold mb-1">Resume Builder</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a professional resume with your certificates
                  </p>
                  <Badge variant="secondary" className="mt-3">20 credits</Badge>
                </Card>

                <Card 
                  className="p-6 cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/careers')}
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Target className="w-6 h-6 text-green-500" />
                  </div>
                  <h3 className="font-semibold mb-1">Career Explorer</h3>
                  <p className="text-sm text-muted-foreground">
                    Browse 1,000+ career paths with salary insights
                  </p>
                  <Badge variant="secondary" className="mt-3">Free</Badge>
                </Card>
              </div>
            </section>

            {/* Career Paths */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Popular Career Paths</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/careers')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingCareers ? (
                  Array(4).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-40 rounded-xl" />
                  ))
                ) : careerPaths && careerPaths.length > 0 ? (
                  careerPaths.map((path) => (
                    <CareerPathCard key={path.id} careerPath={path} variant="featured" />
                  ))
                ) : (
                  // Fallback career paths
                  [
                    { title: 'Web Developer', icon: '💻', courses: 15, salary: '$70K-$120K' },
                    { title: 'Data Scientist', icon: '📊', courses: 12, salary: '$90K-$150K' },
                    { title: 'UX Designer', icon: '🎨', courses: 10, salary: '$65K-$110K' },
                    { title: 'Cloud Engineer', icon: '☁️', courses: 18, salary: '$80K-$140K' },
                  ].map((path, i) => (
                    <Card key={i} className="p-4 cursor-pointer hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{path.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{path.title}</h3>
                          <p className="text-sm text-muted-foreground">{path.courses} courses • {path.salary}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </section>

            {/* Learning Streak */}
            {user && learningStats && (
              <Card className="p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Flame className="w-8 h-8 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {learningStats.currentStreak} Day Streak! 🔥
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Keep learning to maintain your streak
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-500">
                      {learningStats.longestStreak}
                    </div>
                    <div className="text-xs text-muted-foreground">Best streak</div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
