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
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from '@/components/ui/carousel';
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

// Hero banner images for carousel
const heroBanners = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=400&fit=crop',
    title: 'Master In-Demand Skills',
    subtitle: 'Learn from industry experts and advance your career',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&h=400&fit=crop',
    title: 'Earn Recognized Certificates',
    subtitle: 'Get certified and showcase your expertise',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&h=400&fit=crop',
    title: 'Learn at Your Own Pace',
    subtitle: 'Flexible learning that fits your schedule',
  },
];

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
      <div className="relative overflow-hidden">
        {/* Hero Banner Carousel */}
        <div className="relative">
          <Carousel className="w-full" opts={{ loop: true }}>
            <CarouselContent>
              {heroBanners.map((banner) => (
                <CarouselItem key={banner.id}>
                  <div className="relative h-48 md:h-64">
                    <img 
                      src={banner.image}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">{banner.title}</h2>
                      <p className="text-sm md:text-base text-white/80">{banner.subtitle}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {/* Navigation overlay */}
          <div className="absolute top-4 left-4 z-10">
            <Button onClick={() => navigate(-1)} variant="ghost" size="icon" className="bg-black/30 hover:bg-black/50 text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="absolute top-4 left-16 z-10">
            <h1 className="text-xl font-bold text-white">FeedIn Learn</h1>
            <p className="text-xs text-white/70">Master Skills That Matter</p>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/50">
          <div className="container mx-auto px-4 py-4">
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
        </div>

        {/* Search Bar */}
        <div className="container mx-auto px-4 py-4">
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
            {/* Categories Carousel */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Browse Categories</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/categories')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {loadingCategories ? (
                <div className="flex gap-3">
                  {Array(6).fill(0).map((_, i) => (
                    <Skeleton key={i} className="w-32 h-40 rounded-xl shrink-0" />
                  ))}
                </div>
              ) : categories && categories.length > 0 ? (
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                  <CarouselContent className="-ml-2">
                    {categories.slice(0, 12).map((category) => (
                      <CarouselItem key={category.id} className="pl-2 basis-auto">
                        <CategoryCard category={category} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                  {[
                    { name: 'Technology', slug: 'technology', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=500&fit=crop' },
                    { name: 'Business', slug: 'business', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=500&fit=crop' },
                    { name: 'Design', slug: 'design', image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=500&fit=crop' },
                    { name: 'Marketing', slug: 'marketing', image: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400&h=500&fit=crop' },
                    { name: 'Health', slug: 'health', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop' },
                    { name: 'Language', slug: 'language', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=500&fit=crop' },
                  ].map((cat, i) => (
                    <motion.div 
                      key={i} 
                      className="relative w-32 shrink-0 rounded-xl overflow-hidden aspect-[3/4] cursor-pointer group"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/ai/learn/category/${cat.slug}`)}
                    >
                      <img 
                        src={cat.image} 
                        alt={cat.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h4 className="font-semibold text-white text-sm">{cat.name}</h4>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* Featured Courses Carousel */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <h2 className="text-lg font-semibold text-foreground">Featured Courses</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/courses?filter=featured')}>
                  See All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {loadingFeatured ? (
                <div className="flex gap-4">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="w-72 h-64 rounded-xl shrink-0" />
                  ))}
                </div>
              ) : featuredCourses && featuredCourses.length > 0 ? (
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                  <CarouselContent className="-ml-4">
                    {featuredCourses.map((course) => (
                      <CarouselItem key={course.id} className="pl-4 basis-auto">
                        <div className="w-72">
                          <CourseCard course={course} variant="featured" />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              ) : (
                <Card className="w-full p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Featured courses coming soon!</p>
                </Card>
              )}
            </section>

            {/* Popular Courses */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-foreground">Most Popular</h2>
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

            {/* Career Paths Carousel */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Explore Career Paths</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('careers')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {loadingCareers ? (
                <div className="flex gap-4">
                  {Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="w-64 h-80 rounded-xl shrink-0" />
                  ))}
                </div>
              ) : careerPaths && careerPaths.length > 0 ? (
                <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                  <CarouselContent className="-ml-4">
                    {careerPaths.map((path) => (
                      <CarouselItem key={path.id} className="pl-4 basis-auto">
                        <div className="w-64">
                          <CareerPathCard careerPath={path} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              ) : (
                <Card className="w-full p-8 text-center">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Career paths coming soon!</p>
                </Card>
              )}
            </section>

            {/* Top Instructors */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-purple-500" />
                  <h2 className="text-lg font-semibold text-foreground">Top Instructors</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">New & Noteworthy</h2>
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
              className="relative overflow-hidden rounded-2xl"
            >
              <img 
                src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&h=400&fit=crop"
                alt="Become an Instructor"
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-accent/90" />
              <div className="absolute inset-0 flex items-center">
                <div className="p-6 relative z-10">
                  <h3 className="text-xl font-bold text-white mb-2">Become an Instructor</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Share your expertise and earn credits teaching others
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => navigate('/ai/learn/teach')}>
                    Start Teaching <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
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
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
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
                            <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 relative group">
                              <img 
                                src={enrollment.course?.thumbnail_url || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=150&fit=crop`}
                                alt={enrollment.course?.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Play className="w-6 h-6 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate text-foreground">{enrollment.course?.title}</h3>
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
                      <h3 className="font-semibold mb-2 text-foreground">No courses in progress</h3>
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
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
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
                            <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 relative">
                              <img 
                                src={enrollment.course?.thumbnail_url || `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=200&fit=crop`}
                                alt={enrollment.course?.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                <Award className="w-6 h-6 text-green-500" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate text-foreground">{enrollment.course?.title}</h3>
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
                  <h2 className="text-lg font-semibold mb-4 text-foreground">Quick Actions</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Card 
                      className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group h-32"
                      onClick={() => navigate('/ai/learn/certificates')}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1589330694653-ded6df03f754?w=400&h=200&fit=crop"
                        alt="My Certificates"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white">My Certificates</h3>
                        <p className="text-xs text-white/80">View earned credentials</p>
                      </div>
                    </Card>
                    <Card 
                      className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group h-32"
                      onClick={() => navigate('/ai/learn/aptitude')}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop"
                        alt="Aptitude Tests"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white">Aptitude Tests</h3>
                        <p className="text-xs text-white/80">Assess your skills</p>
                      </div>
                    </Card>
                    <Card 
                      className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group h-32"
                      onClick={() => navigate('/ai/learn/resume')}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=200&fit=crop"
                        alt="Resume Builder"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white">Resume Builder</h3>
                        <p className="text-xs text-white/80">Build your profile</p>
                      </div>
                    </Card>
                    <Card 
                      className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group h-32"
                      onClick={() => navigate('/ai/learn/saved')}
                    >
                      <img 
                        src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=200&fit=crop"
                        alt="Saved Courses"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-semibold text-white">Saved Courses</h3>
                        <p className="text-xs text-white/80">Your wishlist</p>
                      </div>
                    </Card>
                  </div>
                </section>
              </>
            ) : (
              <Card className="p-8 text-center">
                <GraduationCap className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2 text-foreground">Sign in to track your learning</h3>
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
              <h2 className="text-lg font-semibold mb-4 text-foreground">Career Development Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card 
                  className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/aptitude')}
                >
                  <img 
                    src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop"
                    alt="Aptitude Tests"
                    className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-semibold text-white mb-1">Aptitude Tests</h3>
                    <p className="text-xs text-white/80">Discover your strengths</p>
                    <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-0">10 credits</Badge>
                  </div>
                </Card>

                <Card 
                  className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/resume')}
                >
                  <img 
                    src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=200&fit=crop"
                    alt="Resume Builder"
                    className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-semibold text-white mb-1">Resume Builder</h3>
                    <p className="text-xs text-white/80">Create professional resume</p>
                    <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-0">20 credits</Badge>
                  </div>
                </Card>

                <Card 
                  className="relative overflow-hidden cursor-pointer transition-all hover:shadow-lg group"
                  onClick={() => navigate('/ai/learn/careers')}
                >
                  <img 
                    src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=200&fit=crop"
                    alt="Career Explorer"
                    className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-semibold text-white mb-1">Career Explorer</h3>
                    <p className="text-xs text-white/80">Browse 1,000+ career paths</p>
                    <Badge variant="secondary" className="mt-2 bg-white/20 text-white border-0">Free</Badge>
                  </div>
                </Card>
              </div>
            </section>

            {/* Career Paths */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Popular Career Paths</h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/careers')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingCareers ? (
                  Array(4).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-xl" />
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
                          <h3 className="font-semibold text-foreground">{path.title}</h3>
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
              <Card className="relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1530092285049-1c42085fd395?w=600&h=200&fit=crop"
                  alt="Learning Streak"
                  className="w-full h-full absolute inset-0 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/90 to-red-500/90" />
                <div className="relative p-6 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Flame className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-white">
                      {learningStats.currentStreak} Day Streak! 🔥
                    </h3>
                    <p className="text-sm text-white/80">
                      Keep learning to maintain your streak
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">
                      {learningStats.longestStreak}
                    </div>
                    <div className="text-xs text-white/80">Best streak</div>
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
