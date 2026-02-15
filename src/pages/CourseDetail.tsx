import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/navigation/BackButton';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Play, Clock, BookOpen, Users, Star, Award, 
  ChevronDown, ChevronUp, Lock, Check, Share2, Heart,
  GraduationCap, MessageSquare, Globe, Calendar, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCourse, useCourseReviews, useEnrollment, useEnrollCourse } from '@/hooks/useLearnData';
import { useAuth } from '@/hooks/useAuth';
import { YouTubePlayer } from '@/components/learn/YouTubePlayer';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { data: course, isLoading } = useCourse(slug || '');
  const { data: reviews } = useCourseReviews(course?.id || '');
  const { data: enrollment } = useEnrollment(course?.id || '');
  const enrollMutation = useEnrollCourse();

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleEnroll = async (isTrial = false) => {
    if (!user) {
      toast.error('Please sign in to enroll');
      navigate('/auth');
      return;
    }

    if (!course) return;

    enrollMutation.mutate({
      courseId: course.id,
      creditCost: isTrial ? 0 : course.credit_cost,
      isTrial,
    });
  };

  const handleStartLearning = () => {
    if (enrollment || course?.trial_modules) {
      navigate(`/ai/learn/course/${slug}/learn`);
    }
  };

  const getLevelColor = (level: string | null) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'intermediate': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'advanced': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getInstructorName = () => {
    if (!course?.instructor) return 'Unknown Instructor';
    const profiles = course.instructor.profiles;
    if (Array.isArray(profiles)) {
      return profiles[0]?.display_name || profiles[0]?.username || 'Unknown';
    }
    return (profiles as any)?.display_name || (profiles as any)?.username || 'Unknown';
  };

  const getInstructorAvatar = () => {
    if (!course?.instructor?.profiles) return undefined;
    const profiles = course.instructor.profiles;
    if (Array.isArray(profiles)) {
      return profiles[0]?.avatar_url;
    }
    return (profiles as any)?.avatar_url;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The course you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/ai/learn')}>Browse Courses</Button>
        </Card>
      </div>
    );
  }

  const totalLessons = course.modules?.reduce((acc: number, mod: any) => 
    acc + (mod.lessons?.length || 0), 0) || course.total_lessons || 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <BackButton fallback="/ai/learn" />
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsSaved(!isSaved)}
              >
                <Heart className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon">
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Video/Thumbnail */}
      <div className="aspect-video bg-black relative">
        {course.preview_video_url ? (
          <YouTubePlayer videoId={course.preview_video_url} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <div className="text-center">
              <Play className="w-16 h-16 mx-auto text-primary/50 mb-2" />
              <span className="text-sm text-muted-foreground">Preview not available</span>
            </div>
          </div>
        )}
      </div>

      {/* Course Info */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Title & Badges */}
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge className={getLevelColor(course.level)} variant="outline">
              {course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : 'All Levels'}
            </Badge>
            {course.course_type === 'diploma' && (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                <Award className="w-3 h-3 mr-1" />
                Diploma
              </Badge>
            )}
            {course.is_bestseller && (
              <Badge className="bg-orange-500/10 text-orange-500">Bestseller</Badge>
            )}
            {course.is_new && (
              <Badge className="bg-green-500/10 text-green-500">New</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
          <p className="text-muted-foreground">{course.short_description}</p>
        </div>

        {/* Stats Row */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            <span className="font-semibold">{course.average_rating?.toFixed(1) || '0.0'}</span>
            <span className="text-muted-foreground">({course.total_reviews || 0} reviews)</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{(course.total_enrolled || 0).toLocaleString()} enrolled</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{course.duration_hours || 0} hours</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <BookOpen className="w-4 h-4" />
            <span>{totalLessons} lessons</span>
          </div>
        </div>

        {/* Instructor Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                <AvatarImage src={getInstructorAvatar()} />
                <AvatarFallback>{getInstructorName()[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{getInstructorName()}</span>
                  {course.instructor?.is_verified && (
                    <Badge variant="secondary" className="text-xs">Verified</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {course.instructor?.expertise?.join(', ') || 'Expert Instructor'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    {course.instructor?.rating?.toFixed(1) || '0.0'}
                  </span>
                  <span>{(course.instructor?.total_students || 0).toLocaleString()} students</span>
                  <span>{course.instructor?.total_courses || 0} courses</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/profile/${(course.instructor?.profiles as any)?.username}`)}>
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">About This Course</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-muted-foreground ${!showFullDescription ? 'line-clamp-4' : ''}`}>
                  {course.description || 'No description available.'}
                </p>
                {course.description && course.description.length > 200 && (
                  <Button
                    variant="link"
                    className="px-0 mt-2"
                    onClick={() => setShowFullDescription(!showFullDescription)}
                  >
                    {showFullDescription ? 'Show Less' : 'Read More'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* What You'll Learn */}
            {course.learning_outcomes && course.learning_outcomes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    What You'll Learn
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {course.learning_outcomes.map((outcome: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-sm">{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            {course.requirements && course.requirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {course.requirements.map((req: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-primary">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Course Info */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span>{course.language || 'English'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Updated {course.last_updated ? format(new Date(course.last_updated), 'MMM yyyy') : 'Recently'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <span>{course.course_type === 'diploma' ? 'Diploma' : 'Certificate'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span>CPD Accredited</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Curriculum Tab */}
          <TabsContent value="curriculum" className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>{course.modules?.length || 0} modules • {totalLessons} lessons</span>
              <span>{course.duration_hours || 0} hours total</span>
            </div>

            {course.modules && course.modules.length > 0 ? (
              <div className="space-y-3">
                {course.modules
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((module: any, moduleIndex: number) => (
                    <Collapsible
                      key={module.id}
                      open={expandedModules.has(module.id)}
                      onOpenChange={() => toggleModule(module.id)}
                    >
                      <Card>
                        <CollapsibleTrigger className="w-full">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                  module.is_trial ? 'bg-green-500/10 text-green-500' : 'bg-muted'
                                }`}>
                                  {moduleIndex + 1}
                                </div>
                                <div className="text-left">
                                  <h3 className="font-medium flex items-center gap-2">
                                    {module.title}
                                    {module.is_trial && (
                                      <Badge variant="secondary" className="text-xs">Free Preview</Badge>
                                    )}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {module.lessons?.length || 0} lessons • {module.duration_minutes || 0} min
                                  </p>
                                </div>
                              </div>
                              {expandedModules.has(module.id) ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t border-border">
                            {module.lessons
                              ?.sort((a: any, b: any) => a.display_order - b.display_order)
                              .map((lesson: any, lessonIndex: number) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                    {lessonIndex + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {lesson.content_type === 'video' && <Play className="w-3 h-3 text-primary" />}
                                      {lesson.content_type === 'quiz' && <MessageSquare className="w-3 h-3 text-purple-500" />}
                                      <span className="text-sm">{lesson.title}</span>
                                      {lesson.is_preview && (
                                        <Badge variant="outline" className="text-xs">Preview</Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {lesson.duration_minutes || 0} min
                                    </span>
                                  </div>
                                  {!enrollment && !module.is_trial && !lesson.is_preview && (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              ))}
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Curriculum coming soon</p>
              </Card>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            {/* Rating Overview */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold">{course.average_rating?.toFixed(1) || '0.0'}</div>
                    <div className="flex items-center justify-center mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(course.average_rating || 0)
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {course.total_reviews || 0} reviews
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const percentage = reviews?.length
                        ? (reviews.filter((r: any) => r.rating === rating).length / reviews.length) * 100
                        : 0;
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-xs w-3">{rating}</span>
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          <Progress value={percentage} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8">{Math.round(percentage)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reviews List */}
            {reviews && reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.slice(0, 10).map((review: any) => (
                  <Card key={review.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={(review.user as any)?.avatar_url} />
                          <AvatarFallback>{(review.user as any)?.display_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{(review.user as any)?.display_name || 'Anonymous'}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${
                                  star <= review.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'
                                }`}
                              />
                            ))}
                          </div>
                          {review.review_text && (
                            <p className="text-sm text-muted-foreground mt-2">{review.review_text}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed Bottom CTA */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 z-50"
      >
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold">{course.credit_cost}</span>
                <span className="text-muted-foreground">credits</span>
              </div>
              {course.trial_modules && course.trial_modules > 0 && !enrollment && (
                <p className="text-xs text-muted-foreground">
                  {course.trial_modules} module{course.trial_modules > 1 ? 's' : ''} free to preview
                </p>
              )}
            </div>

            {enrollment ? (
              <Button size="lg" onClick={handleStartLearning} className="flex-1 max-w-[200px]">
                <Play className="w-4 h-4 mr-2" />
                Continue Learning
              </Button>
            ) : (
              <div className="flex gap-2">
                {course.trial_modules && course.trial_modules > 0 && (
                  <Button variant="outline" size="lg" onClick={() => handleEnroll(true)}>
                    Try Free
                  </Button>
                )}
                <Button 
                  size="lg" 
                  onClick={() => handleEnroll(false)}
                  disabled={enrollMutation.isPending}
                >
                  {enrollMutation.isPending ? 'Enrolling...' : 'Enroll Now'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
