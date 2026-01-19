import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Fetch categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['learn-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

// Fetch subjects
export const useSubjects = (categoryId?: string) => {
  return useQuery({
    queryKey: ['learn-subjects', categoryId],
    queryFn: async () => {
      let query = supabase.from('subjects').select('*');
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
};

// Fetch courses with filters
export const useCourses = (options?: {
  categoryId?: string;
  subjectId?: string;
  level?: string[];
  courseType?: string[];
  search?: string;
  featured?: boolean;
  limit?: number;
  sortBy?: string;
}) => {
  return useQuery({
    queryKey: ['learn-courses', options],
    queryFn: async () => {
      let query = supabase
        .from('courses')
        .select(`
          *,
          instructor:instructors(
            id,
            user_id,
            rating,
            profiles:user_id(display_name, avatar_url, username)
          ),
          category:course_categories(id, name, slug)
        `)
        .eq('is_published', true);

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.subjectId) {
        query = query.eq('subject_id', options.subjectId);
      }
      if (options?.level && options.level.length > 0) {
        query = query.in('level', options.level);
      }
      if (options?.courseType && options.courseType.length > 0) {
        query = query.in('course_type', options.courseType);
      }
      if (options?.featured) {
        query = query.eq('is_featured', true);
      }
      if (options?.search) {
        query = query.or(`title.ilike.%${options.search}%,short_description.ilike.%${options.search}%`);
      }

      // Sorting
      switch (options?.sortBy) {
        case 'rating':
          query = query.order('average_rating', { ascending: false });
          break;
        case 'popular':
          query = query.order('total_enrolled', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'price-low':
          query = query.order('credit_cost', { ascending: true });
          break;
        case 'price-high':
          query = query.order('credit_cost', { ascending: false });
          break;
        default:
          query = query.order('total_enrolled', { ascending: false });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};

// Fetch single course by slug
export const useCourse = (slug: string) => {
  return useQuery({
    queryKey: ['learn-course', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:instructors(
            id,
            user_id,
            bio,
            expertise,
            qualifications,
            total_students,
            total_courses,
            rating,
            review_count,
            is_verified,
            profiles:user_id(display_name, avatar_url, username, bio)
          ),
          category:course_categories(id, name, slug),
          modules:course_modules(
            id,
            title,
            description,
            display_order,
            is_trial,
            total_lessons,
            duration_minutes,
            lessons:course_lessons(
              id,
              title,
              description,
              content_type,
              duration_minutes,
              display_order,
              is_preview
            )
          )
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
};

// Fetch course reviews
export const useCourseReviews = (courseId: string) => {
  return useQuery({
    queryKey: ['course-reviews', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_reviews')
        .select(`
          *,
          user:user_id(display_name, avatar_url, username)
        `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });
};

// Check if user is enrolled
export const useEnrollment = (courseId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['enrollment', courseId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId && !!user?.id,
  });
};

// Enroll in a course
export const useEnrollCourse = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courseId, creditCost, isTrial = false }: { 
      courseId: string; 
      creditCost: number;
      isTrial?: boolean;
    }) => {
      if (!user?.id) throw new Error('Must be logged in');

      // Check credits if not trial
      if (!isTrial && creditCost > 0) {
        const { data: credits } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (!credits || credits.balance < creditCost) {
          throw new Error('Insufficient credits');
        }

        // Deduct credits via edge function
        const { error: deductError } = await supabase.functions.invoke('credit-deduction', {
          body: {
            amount: creditCost,
            description: `Course enrollment`,
            toolName: 'learn-course-enrollment',
          },
        });

        if (deductError) throw deductError;
      }

      // Get course total lessons
      const { data: course } = await supabase
        .from('courses')
        .select('total_lessons')
        .eq('id', courseId)
        .single();

      // Create enrollment
      const { data, error } = await supabase
        .from('course_enrollments')
        .insert({
          user_id: user.id,
          course_id: courseId,
          credits_paid: isTrial ? 0 : creditCost,
          is_trial: isTrial,
          total_lessons: course?.total_lessons || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment', variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ['user-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      toast.success('Successfully enrolled in course!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to enroll');
    },
  });
};

// User's enrollments
export const useUserEnrollments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-enrollments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          *,
          course:courses(
            id,
            slug,
            title,
            thumbnail_url,
            duration_hours,
            total_lessons,
            instructor:instructors(
              profiles:user_id(display_name, avatar_url)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('last_accessed_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// User's certificates
export const useUserCertificates = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-certificates', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          course:courses(
            title,
            thumbnail_url,
            instructor:instructors(
              profiles:user_id(display_name)
            )
          )
        `)
        .eq('user_id', user.id)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// Career paths
export const useCareerPaths = (options?: { featured?: boolean; limit?: number }) => {
  return useQuery({
    queryKey: ['career-paths', options],
    queryFn: async () => {
      let query = supabase.from('career_paths').select('*');
      
      if (options?.featured) {
        query = query.eq('is_featured', true);
      }
      
      query = query.order('display_order', { ascending: true });
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
};

// Aptitude tests
export const useAptitudeTests = () => {
  return useQuery({
    queryKey: ['aptitude-tests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aptitude_tests')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
};

// Learning stats
export const useLearningStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['learning-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [enrollments, certificates, streak] = await Promise.all([
        supabase
          .from('course_enrollments')
          .select('is_completed, course:courses(duration_hours)')
          .eq('user_id', user.id),
        supabase
          .from('certificates')
          .select('id')
          .eq('user_id', user.id),
        supabase
          .from('learning_streaks')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const inProgress = enrollments.data?.filter(e => !e.is_completed).length || 0;
      const completed = enrollments.data?.filter(e => e.is_completed).length || 0;
      const totalHours = enrollments.data?.reduce((acc, e) => {
        return acc + (e.course?.duration_hours || 0);
      }, 0) || 0;

      return {
        coursesInProgress: inProgress,
        coursesCompleted: completed,
        certificatesEarned: certificates.data?.length || 0,
        totalHoursLearned: totalHours,
        currentStreak: streak.data?.current_streak || 0,
        longestStreak: streak.data?.longest_streak || 0,
      };
    },
    enabled: !!user?.id,
  });
};

// Featured instructors
export const useFeaturedInstructors = (limit = 6) => {
  return useQuery({
    queryKey: ['featured-instructors', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructors')
        .select(`
          *,
          profiles:user_id(display_name, avatar_url, username, bio)
        `)
        .eq('is_active', true)
        .eq('is_verified', true)
        .order('total_students', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });
};

// Platform stats
export const usePlatformStats = () => {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const [courses, enrollments, certificates, instructors] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('course_enrollments').select('id', { count: 'exact', head: true }),
        supabase.from('certificates').select('id', { count: 'exact', head: true }),
        supabase.from('instructors').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      return {
        totalCourses: courses.count || 0,
        totalEnrollments: enrollments.count || 0,
        totalCertificates: certificates.count || 0,
        totalInstructors: instructors.count || 0,
      };
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};
