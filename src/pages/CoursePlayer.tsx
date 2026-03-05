import { useState, useEffect, useCallback, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, Menu, X, Check, Lock,
  Play, Pause, BookOpen, FileText, MessageSquare, Download,
  ChevronDown, ChevronUp, Clock, Award, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourse, useEnrollment } from '@/hooks/useLearnData';
import { useAuth } from '@/hooks/useAuth';
import { YouTubePlayer } from '@/components/learn/YouTubePlayer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LessonProgress {
  lesson_id: string;
  is_completed: boolean;
}

export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [lessonProgress, setLessonProgress] = useState<Map<string, boolean>>(new Map());
  const [isCompleting, setIsCompleting] = useState(false);

  const { data: course, isLoading } = useCourse(slug || '');
  const { data: enrollment } = useEnrollment(course?.id || '');

  // Flatten lessons for navigation
  const allLessons = course?.modules
    ?.sort((a: any, b: any) => a.display_order - b.display_order)
    .flatMap((module: any) =>
      module.lessons
        ?.sort((a: any, b: any) => a.display_order - b.display_order)
        .map((lesson: any) => ({
          ...lesson,
          moduleId: module.id,
          moduleTitle: module.title,
          isTrial: module.is_trial,
        }))
    ) || [];

  const currentLesson = allLessons.find((l: any) => l.id === currentLessonId);
  const currentIndex = allLessons.findIndex((l: any) => l.id === currentLessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Load lesson progress
  useEffect(() => {
    if (user && course?.id) {
      loadLessonProgress();
    }
  }, [user, course?.id]);

  // Set initial lesson
  useEffect(() => {
    if (allLessons.length > 0 && !currentLessonId) {
      // Find first incomplete lesson or first lesson
      const firstIncomplete = allLessons.find((l: any) => !lessonProgress.get(l.id));
      setCurrentLessonId(firstIncomplete?.id || allLessons[0]?.id);
      
      // Expand the module containing the current lesson
      const lessonModule = allLessons.find((l: any) => l.id === (firstIncomplete?.id || allLessons[0]?.id));
      if (lessonModule) {
        setExpandedModules(new Set([lessonModule.moduleId]));
      }
    }
  }, [allLessons, lessonProgress]);

  const loadLessonProgress = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('lesson_progress')
      .select('lesson_id, is_completed')
      .eq('user_id', user.id);

    if (data) {
      const progressMap = new Map<string, boolean>();
      data.forEach((p) => progressMap.set(p.lesson_id, p.is_completed));
      setLessonProgress(progressMap);
    }
  };

  const markLessonComplete = async (lessonId: string) => {
    if (!user?.id || !course?.id) return;

    setIsCompleting(true);
    try {
      const { error } = await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          is_completed: true,
          completed_at: new Date().toISOString(),
        });

      if (error) throw error;

      setLessonProgress((prev) => new Map(prev).set(lessonId, true));

      // Update enrollment progress
      const completedCount = Array.from(lessonProgress.values()).filter(Boolean).length + 1;
      const totalLessons = allLessons.length;
      const progressPercent = (completedCount / totalLessons) * 100;

      await supabase
        .from('course_enrollments')
        .update({
          progress_percent: progressPercent,
          completed_lessons: completedCount,
          last_accessed_at: new Date().toISOString(),
          is_completed: progressPercent >= 100,
          completed_at: progressPercent >= 100 ? new Date().toISOString() : null,
        })
        .eq('user_id', user.id)
        .eq('course_id', course.id);

      if (progressPercent >= 100) {
        toast.success('🎉 Congratulations! You completed the course!');
      } else {
        toast.success('Lesson completed!');
      }
    } catch (error) {
      toast.error('Failed to save progress');
    } finally {
      setIsCompleting(false);
    }
  };

  const canAccessLesson = (lesson: any) => {
    if (enrollment) return true;
    if (lesson.isTrial || lesson.is_preview) return true;
    return false;
  };

  const goToLesson = (lessonId: string) => {
    const lesson = allLessons.find((l: any) => l.id === lessonId);
    if (lesson && canAccessLesson(lesson)) {
      setCurrentLessonId(lessonId);
      setExpandedModules(new Set([lesson.moduleId]));
      setSidebarOpen(false);
    } else {
      toast.error('Please enroll to access this lesson');
    }
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const completedLessonsCount = Array.from(lessonProgress.values()).filter(Boolean).length;
  const overallProgress = allLessons.length > 0 ? (completedLessonsCount / allLessons.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-screen flex flex-col">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="flex-1" />
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
          <Button onClick={() => navigate('/ai/learn')}>Browse Courses</Button>
        </Card>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="h-full flex flex-col bg-card">
      {/* Course Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold line-clamp-2 mb-2">{course.title}</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your Progress</span>
            <span className="font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {completedLessonsCount} of {allLessons.length} lessons completed
          </p>
        </div>
      </div>

      {/* Modules List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {course.modules
            ?.sort((a: any, b: any) => a.display_order - b.display_order)
            .map((module: any, moduleIndex: number) => {
              const moduleLessons = allLessons.filter((l: any) => l.moduleId === module.id);
              const moduleCompleted = moduleLessons.every((l: any) => lessonProgress.get(l.id));
              const moduleProgress = moduleLessons.length > 0
                ? (moduleLessons.filter((l: any) => lessonProgress.get(l.id)).length / moduleLessons.length) * 100
                : 0;

              return (
                <Collapsible
                  key={module.id}
                  open={expandedModules.has(module.id)}
                  onOpenChange={() => toggleModule(module.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors ${
                      expandedModules.has(module.id) ? 'bg-muted/50' : ''
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                        moduleCompleted ? 'bg-green-500/20 text-green-500' : 'bg-muted'
                      }`}>
                        {moduleCompleted ? <Check className="w-4 h-4" /> : moduleIndex + 1}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{module.title}</span>
                          {module.is_trial && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Free</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Progress value={moduleProgress} className="h-1 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {moduleLessons.length} lessons
                          </span>
                        </div>
                      </div>
                      {expandedModules.has(module.id) ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 border-l border-border pl-4 py-2 space-y-1">
                      {moduleLessons.map((lesson: any, lessonIndex: number) => {
                        const isCompleted = lessonProgress.get(lesson.id);
                        const isCurrent = lesson.id === currentLessonId;
                        const canAccess = canAccessLesson(lesson);

                        return (
                          <button
                            key={lesson.id}
                            onClick={() => goToLesson(lesson.id)}
                            disabled={!canAccess}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                              isCurrent 
                                ? 'bg-primary/10 text-primary' 
                                : canAccess 
                                  ? 'hover:bg-muted/50' 
                                  : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                              isCompleted 
                                ? 'bg-green-500 text-white' 
                                : isCurrent 
                                  ? 'bg-primary text-primary-foreground' 
                                  : 'bg-muted'
                            }`}>
                              {isCompleted ? <Check className="w-3 h-3" /> : lessonIndex + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm truncate block">{lesson.title}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                {lesson.content_type === 'video' && <Play className="w-2 h-2" />}
                                {lesson.content_type === 'quiz' && <MessageSquare className="w-2 h-2" />}
                                {lesson.content_type === 'text' && <FileText className="w-2 h-2" />}
                                {lesson.duration_minutes || 0} min
                              </span>
                            </div>
                            {!canAccess && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button onClick={() => navigate(`/ai/learn/course/${slug}`)} variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="hidden md:block">
              <h1 className="font-semibold line-clamp-1">{course.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress indicator */}
            <div className="hidden sm:flex items-center gap-2 mr-4">
              <Progress value={overallProgress} className="w-32 h-2" />
              <span className="text-sm text-muted-foreground">{Math.round(overallProgress)}%</span>
            </div>

            {/* Certificate button */}
            {overallProgress >= 100 && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/ai/learn/course/${slug}/certificate`)}>
                <Award className="w-4 h-4 mr-2" />
                Get Certificate
              </Button>
            )}

            {/* Mobile sidebar toggle */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <Sidebar />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Content Area */}
        <div className="flex-1 min-h-[calc(100vh-57px)]">
          {currentLesson ? (
            <div className="max-w-4xl mx-auto">
              {/* Video/Content */}
              <div className="aspect-video bg-black">
                {currentLesson.content_type === 'video' && currentLesson.youtube_video_id ? (
                  <YouTubePlayer videoId={currentLesson.youtube_video_id} />
                ) : currentLesson.content_type === 'video' && currentLesson.content_url ? (
                  <video
                    src={currentLesson.content_url}
                    controls
                    className="w-full h-full"
                    autoPlay
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                    <FileText className="w-16 h-16 text-primary/50" />
                  </div>
                )}
              </div>

              {/* Lesson Info */}
              <div className="p-6 space-y-6">
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {currentLesson.moduleTitle}
                  </Badge>
                  <h2 className="text-2xl font-bold">{currentLesson.title}</h2>
                  {currentLesson.description && (
                    <p className="text-muted-foreground mt-2">{currentLesson.description}</p>
                  )}
                </div>

                {/* Text Content */}
                {currentLesson.content_type === 'text' && currentLesson.content_text && (
                  <Card>
                    <CardContent className="p-6 prose prose-sm dark:prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentLesson.content_text, {
                        ALLOWED_TAGS: ['p','br','strong','em','b','i','u','ul','ol','li','h1','h2','h3','h4','code','pre','blockquote','a','span','div','table','thead','tbody','tr','td','th','img','hr'],
                        ALLOWED_ATTR: ['class','href','target','rel','src','alt','width','height']
                      }) }} />
                    </CardContent>
                  </Card>
                )}

                {/* Navigation & Complete Button */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => prevLesson && goToLesson(prevLesson.id)}
                    disabled={!prevLesson}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>

                  {!lessonProgress.get(currentLessonId!) ? (
                    <Button
                      onClick={() => markLessonComplete(currentLessonId!)}
                      disabled={isCompleting}
                    >
                      {isCompleting ? 'Saving...' : 'Mark as Complete'}
                      <Check className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      <Check className="w-4 h-4 mr-1" />
                      Completed
                    </Badge>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => nextLesson && goToLesson(nextLesson.id)}
                    disabled={!nextLesson}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[calc(100vh-57px)]">
              <Card className="p-8 text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2">No Lessons Available</h2>
                <p className="text-muted-foreground">This course doesn't have any lessons yet.</p>
              </Card>
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-l border-border">
          <div className="sticky top-[57px] h-[calc(100vh-57px)]">
            <Sidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
