import React from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Briefcase, DollarSign, TrendingUp, GraduationCap, Clock, CheckCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CourseCard } from '@/components/learn/CourseCard';

const CareerPathDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data: careerPath, isLoading } = useQuery({
    queryKey: ['career-path', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_paths')
        .select(`
          *,
          career_path_courses(
            course:courses(
              id,
              title,
              slug,
              thumbnail_url,
              credit_cost,
              duration_hours,
              average_rating,
              total_enrolled,
              level,
              instructor:instructors(
                profiles:profiles(display_name, avatar_url)
              )
            )
          )
        `)
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl mb-4" />
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!careerPath) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Career Path Not Found</h1>
          <Button onClick={() => navigate('/ai/learn/careers')}>Browse Careers</Button>
        </div>
      </div>
    );
  }

  const courses = careerPath.career_path_courses?.map((cpc: any) => cpc.course).filter(Boolean) || [];
  const skills = careerPath.skills_required || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold line-clamp-1">{careerPath.title}</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/20 via-card to-accent/10 rounded-2xl p-6 border"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center text-3xl">
              {careerPath.icon || '💼'}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-2">
                {careerPath.is_featured && (
                  <Badge className="bg-primary">Featured</Badge>
                )}
                {careerPath.is_trending && (
                  <Badge className="bg-green-500">Trending</Badge>
                )}
                {careerPath.category && (
                  <Badge variant="secondary">{careerPath.category}</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-2">{careerPath.title}</h1>
              <p className="text-muted-foreground">{careerPath.description}</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 border text-center"
          >
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-sm text-muted-foreground">Salary Range</p>
            <p className="font-bold">
              {careerPath.salary_currency || '$'}
              {(careerPath.salary_range_min || 0).toLocaleString()} - {(careerPath.salary_range_max || 0).toLocaleString()}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 border text-center"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Growth Rate</p>
            <p className="font-bold">{careerPath.growth_rate || 'N/A'}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl p-4 border text-center"
          >
            <GraduationCap className="w-6 h-6 mx-auto mb-2 text-purple-400" />
            <p className="text-sm text-muted-foreground">Education</p>
            <p className="font-bold text-sm">{careerPath.education_required || 'Varies'}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl p-4 border text-center"
          >
            <Briefcase className="w-6 h-6 mx-auto mb-2 text-orange-400" />
            <p className="text-sm text-muted-foreground">Experience</p>
            <p className="font-bold">{careerPath.experience_level || 'Entry'}</p>
          </motion.div>
        </div>

        {/* Job Outlook */}
        {careerPath.job_outlook && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-card rounded-xl p-4 border"
          >
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Job Outlook
            </h3>
            <p className="text-muted-foreground">{careerPath.job_outlook}</p>
          </motion.div>
        )}

        {/* Required Skills */}
        {skills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card rounded-xl p-4 border"
          >
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Required Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: string, index: number) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {skill}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recommended Courses */}
        {courses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Recommended Courses ({courses.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course: any, index: number) => (
                <CourseCard key={course.id} course={course} variant="horizontal" />
              ))}
            </div>
          </motion.div>
        )}

        {/* Start Path CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-6 border text-center"
        >
          <h3 className="text-lg font-bold mb-2">Ready to Start This Career Path?</h3>
          <p className="text-muted-foreground mb-4">
            Enroll in recommended courses and track your progress
          </p>
          <Button size="lg" className="gap-2" onClick={() => navigate('/ai/learn')}>
            <BookOpen className="w-5 h-5" />
            Browse All Courses
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default CareerPathDetail;
