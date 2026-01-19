import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CourseCard } from '@/components/learn/CourseCard';
import { PageWrapper } from '@/components/shared/PageWrapper';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

const CategoryCourses = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const { data } = await supabase
        .from('course_categories')
        .select('*')
        .eq('slug', slug)
        .single();
      return data;
    },
    enabled: !!slug,
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['category-courses', category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      
      const { data } = await supabase
        .from('courses')
        .select(`
          *,
          instructors(
            id,
            user_id,
            profiles:user_id(
              display_name,
              avatar_url
            )
          )
        `)
        .eq('category_id', category.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      
      return data || [];
    },
    enabled: !!category?.id,
  });

  const isLoading = categoryLoading || coursesLoading;

  return (
    <PageWrapper>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {category?.name || 'Category'}
              </h1>
              {category?.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Stats */}
          {category && (
            <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4" />
              <span>{courses?.length || 0} courses available</span>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Courses Grid */}
          {!isLoading && courses && courses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <CourseCard course={course} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && (!courses || courses.length === 0) && (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No courses yet
              </h3>
              <p className="text-muted-foreground mb-4">
                We're working on adding courses to this category.
              </p>
              <Button onClick={() => navigate('/ai/learn')}>
                Browse All Courses
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
};

export default CategoryCourses;
