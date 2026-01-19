import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Clock, Award, Play, TrendingUp, 
  ChevronRight, Flame, GraduationCap, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { useUserEnrollments, useLearningStats, useUserCertificates } from '@/hooks/useLearnData';
import { LearningStats } from '@/components/learn/LearningStats';

const MyLearning = () => {
  const navigate = useNavigate();
  const { data: enrollments, isLoading: enrollmentsLoading } = useUserEnrollments();
  const { data: stats, isLoading: statsLoading } = useLearningStats();
  const { data: certificates, isLoading: certificatesLoading } = useUserCertificates();

  const inProgressCourses = enrollments?.filter(e => !e.is_completed) || [];
  const completedCourses = enrollments?.filter(e => e.is_completed) || [];

  const CourseCard = ({ enrollment, showProgress = true }: { 
    enrollment: any; 
    showProgress?: boolean;
  }) => {
    const course = enrollment.course;
    const instructor = course?.instructor?.profiles;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/ai/learn/course/${course?.slug}/learn`)}
        className="cursor-pointer"
      >
        <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50">
          <div className="flex gap-4 p-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-20 rounded-lg overflow-hidden flex-shrink-0">
              {course?.thumbnail_url ? (
                <img 
                  src={course.thumbnail_url} 
                  alt={course?.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary/60" />
                </div>
              )}
              {showProgress && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Play className="w-8 h-8 text-white fill-white" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground line-clamp-2 text-sm sm:text-base">
                {course?.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {instructor?.display_name || 'Instructor'}
              </p>
              
              {showProgress && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {enrollment.completed_lessons || 0}/{enrollment.total_lessons || 0} lessons
                    </span>
                    <span className="font-medium text-primary">
                      {enrollment.progress_percent || 0}%
                    </span>
                  </div>
                  <Progress value={enrollment.progress_percent || 0} className="h-1.5" />
                </div>
              )}

              {!showProgress && enrollment.completed_at && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                    <Award className="w-3 h-3 mr-1" />
                    Completed
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(enrollment.completed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    );
  };

  const ContinueLearningCard = ({ enrollment }: { enrollment: any }) => {
    const course = enrollment.course;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        className="relative overflow-hidden rounded-xl cursor-pointer group"
        onClick={() => navigate(`/ai/learn/course/${course?.slug}/learn`)}
      >
        <div className="aspect-video relative">
          {course?.thumbnail_url ? (
            <img 
              src={course.thumbnail_url} 
              alt={course?.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Play className="w-8 h-8 text-primary-foreground fill-primary-foreground ml-1" />
            </div>
          </div>
          
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-white line-clamp-2 text-lg">
              {course?.title}
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <Progress value={enrollment.progress_percent || 0} className="flex-1 h-1.5 bg-white/20" />
              <span className="text-white/80 text-sm font-medium">
                {enrollment.progress_percent || 0}%
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (enrollmentsLoading || statsLoading) {
    return (
      <PageWrapper>
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-4xl mx-auto p-4 pb-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Learning</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Continue your learning journey
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate('/ai/learn')}
            className="gap-2"
          >
            <Target className="w-4 h-4" />
            Explore Courses
          </Button>
        </div>

        {/* Learning Stats */}
        {stats && <LearningStats stats={stats} variant="default" />}

        {/* Continue Learning Section */}
        {inProgressCourses.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Continue Learning
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inProgressCourses.slice(0, 2).map((enrollment: any) => (
                <ContinueLearningCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </div>
          </section>
        )}

        {/* Tabs for All Courses */}
        <Tabs defaultValue="in-progress" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="in-progress" className="gap-2">
              <BookOpen className="w-4 h-4" />
              In Progress ({inProgressCourses.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <Award className="w-4 h-4" />
              Completed ({completedCourses.length})
            </TabsTrigger>
            <TabsTrigger value="certificates" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              Certificates ({certificates?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in-progress" className="space-y-4 mt-4">
            {inProgressCourses.length === 0 ? (
              <Card className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No courses in progress</h3>
                <p className="text-muted-foreground mb-4">
                  Start learning today by enrolling in a course
                </p>
                <Button onClick={() => navigate('/ai/learn')}>
                  Browse Courses
                </Button>
              </Card>
            ) : (
              inProgressCourses.map((enrollment: any) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-4">
            {completedCourses.length === 0 ? (
              <Card className="p-8 text-center">
                <Award className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No completed courses yet</h3>
                <p className="text-muted-foreground">
                  Complete your first course to see it here
                </p>
              </Card>
            ) : (
              completedCourses.map((enrollment: any) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} showProgress={false} />
              ))
            )}
          </TabsContent>

          <TabsContent value="certificates" className="space-y-4 mt-4">
            {certificatesLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : certificates?.length === 0 ? (
              <Card className="p-8 text-center">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">No certificates yet</h3>
                <p className="text-muted-foreground">
                  Complete a course to earn your first certificate
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {certificates?.map((cert: any) => (
                  <motion.div
                    key={cert.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="overflow-hidden hover:shadow-lg transition-all">
                      <div className="flex gap-4 p-4">
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Award className="w-10 h-10 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold line-clamp-1">
                            {cert.course?.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Certificate #{cert.certificate_number}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Issued: {new Date(cert.issue_date).toLocaleDateString()}
                            </span>
                            <Button 
                              variant="link" 
                              className="text-xs p-0 h-auto"
                              onClick={() => navigate(`/ai/learn/certificates`)}
                            >
                              View Certificate
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Learning Streak Widget */}
        {stats && stats.currentStreak > 0 && (
          <Card className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg">{stats.currentStreak} Day Streak!</p>
                  <p className="text-sm text-muted-foreground">
                    Keep learning to maintain your streak
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Best</p>
                <p className="font-bold text-lg">{stats.longestStreak} days</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
};

export default MyLearning;