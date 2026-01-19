
-- =====================================================
-- FEEDIN LEARN TECH - COMPREHENSIVE LMS DATABASE SCHEMA
-- =====================================================

-- 1. Course Categories
CREATE TABLE public.course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.course_categories(id),
  course_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subjects (for filtering)
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES public.course_categories(id),
  course_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Instructors/Skill Experts
CREATE TABLE public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  bio TEXT,
  expertise TEXT[],
  qualifications TEXT[],
  total_students INTEGER DEFAULT 0,
  total_courses INTEGER DEFAULT 0,
  total_earnings_credits INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  payout_percentage INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Courses
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES public.instructors(id) NOT NULL,
  category_id UUID REFERENCES public.course_categories(id),
  subject_id UUID REFERENCES public.subjects(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  preview_video_url TEXT,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced', 'all-levels')),
  course_type TEXT CHECK (course_type IN ('certificate', 'diploma', 'short-course')) DEFAULT 'certificate',
  duration_hours DECIMAL(5,2) DEFAULT 0,
  credit_cost INTEGER NOT NULL DEFAULT 50,
  trial_modules INTEGER DEFAULT 1,
  total_modules INTEGER DEFAULT 0,
  total_lessons INTEGER DEFAULT 0,
  total_enrolled INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  is_bestseller BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT true,
  tags TEXT[],
  learning_outcomes TEXT[],
  requirements TEXT[],
  language TEXT DEFAULT 'English',
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Course Modules
CREATE TABLE public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_trial BOOLEAN DEFAULT false,
  total_lessons INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Course Lessons
CREATE TABLE public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT CHECK (content_type IN ('video', 'text', 'quiz', 'assignment', 'pdf', 'article')) DEFAULT 'video',
  content_url TEXT,
  content_text TEXT,
  youtube_video_id TEXT,
  duration_minutes INTEGER DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Lesson Resources (Downloadable materials)
CREATE TABLE public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  is_premium_only BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Course Enrollments
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) NOT NULL,
  credits_paid INTEGER DEFAULT 0,
  progress_percent DECIMAL(5,2) DEFAULT 0,
  completed_lessons INTEGER DEFAULT 0,
  total_lessons INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  is_trial BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  certificate_id UUID,
  last_lesson_id UUID,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- 9. Lesson Progress
CREATE TABLE public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  progress_seconds INTEGER DEFAULT 0,
  total_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- 10. Course Assessments
CREATE TABLE public.course_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pass_percentage INTEGER DEFAULT 80,
  max_attempts INTEGER,
  time_limit_minutes INTEGER,
  total_questions INTEGER DEFAULT 0,
  is_final_assessment BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Assessment Questions
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.course_assessments(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false')) DEFAULT 'single_choice',
  options JSONB NOT NULL DEFAULT '[]',
  explanation TEXT,
  points INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Assessment Attempts
CREATE TABLE public.assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  assessment_id UUID REFERENCES public.course_assessments(id) ON DELETE CASCADE NOT NULL,
  answers JSONB DEFAULT '{}',
  score_percent DECIMAL(5,2) DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INTEGER
);

-- 13. Certificates
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) NOT NULL,
  enrollment_id UUID REFERENCES public.course_enrollments(id),
  certificate_number TEXT UNIQUE NOT NULL,
  certificate_type TEXT CHECK (certificate_type IN ('certificate', 'diploma')) DEFAULT 'certificate',
  issue_date TIMESTAMPTZ DEFAULT now(),
  certificate_url TEXT,
  is_verified BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Course Reviews
CREATE TABLE public.course_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  review_text TEXT,
  is_verified_purchase BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  instructor_reply TEXT,
  instructor_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- 15. Career Paths
CREATE TABLE public.career_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  salary_range_min INTEGER,
  salary_range_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  job_outlook TEXT,
  growth_rate TEXT,
  skills_required TEXT[],
  education_required TEXT,
  experience_level TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_trending BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  total_courses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Career Path Courses
CREATE TABLE public.career_path_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_id UUID REFERENCES public.career_paths(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(career_path_id, course_id)
);

-- 17. Aptitude Tests
CREATE TABLE public.aptitude_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  test_type TEXT CHECK (test_type IN ('verbal', 'numerical', 'abstract', 'logical', 'technical', 'personality', 'career')) DEFAULT 'logical',
  duration_minutes INTEGER DEFAULT 30,
  credit_cost INTEGER DEFAULT 10,
  total_questions INTEGER DEFAULT 0,
  passing_score INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 18. Aptitude Test Questions
CREATE TABLE public.aptitude_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.aptitude_tests(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  correct_option_id TEXT,
  explanation TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  points INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Aptitude Test Results
CREATE TABLE public.aptitude_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  test_id UUID REFERENCES public.aptitude_tests(id) ON DELETE CASCADE NOT NULL,
  score_percent DECIMAL(5,2) DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  answers JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INTEGER,
  passed BOOLEAN DEFAULT false,
  recommendations JSONB DEFAULT '[]'
);

-- 20. User Resumes
CREATE TABLE public.user_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  template_id TEXT DEFAULT 'modern',
  title TEXT DEFAULT 'My Resume',
  personal_info JSONB DEFAULT '{}',
  summary TEXT,
  education JSONB DEFAULT '[]',
  experience JSONB DEFAULT '[]',
  skills TEXT[],
  certifications JSONB DEFAULT '[]',
  languages JSONB DEFAULT '[]',
  projects JSONB DEFAULT '[]',
  awards JSONB DEFAULT '[]',
  custom_sections JSONB DEFAULT '[]',
  is_public BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  download_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. Instructor Subscriptions
CREATE TABLE public.instructor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  instructor_id UUID REFERENCES public.instructors(id) NOT NULL,
  credits_paid INTEGER DEFAULT 0,
  subscription_type TEXT CHECK (subscription_type IN ('monthly', 'yearly', 'lifetime')) DEFAULT 'monthly',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, instructor_id)
);

-- 22. Instructor Payouts
CREATE TABLE public.instructor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES public.instructors(id) NOT NULL,
  amount_credits INTEGER NOT NULL,
  payout_type TEXT CHECK (payout_type IN ('enrollment', 'subscription', 'gift', 'bonus')) DEFAULT 'enrollment',
  source_user_id UUID REFERENCES public.profiles(id),
  source_course_id UUID REFERENCES public.courses(id),
  source_subscription_id UUID REFERENCES public.instructor_subscriptions(id),
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 23. Saved/Bookmarked Courses
CREATE TABLE public.saved_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- 24. Course Notes (user notes while learning)
CREATE TABLE public.course_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  timestamp_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 25. Learning Streaks
CREATE TABLE public.learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_learning_date DATE,
  total_learning_days INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_courses_category ON public.courses(category_id);
CREATE INDEX idx_courses_subject ON public.courses(subject_id);
CREATE INDEX idx_courses_instructor ON public.courses(instructor_id);
CREATE INDEX idx_courses_slug ON public.courses(slug);
CREATE INDEX idx_courses_published ON public.courses(is_published);
CREATE INDEX idx_courses_featured ON public.courses(is_featured);
CREATE INDEX idx_course_modules_course ON public.course_modules(course_id);
CREATE INDEX idx_course_lessons_module ON public.course_lessons(module_id);
CREATE INDEX idx_course_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX idx_course_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON public.lesson_progress(lesson_id);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX idx_career_paths_slug ON public.career_paths(slug);
CREATE INDEX idx_aptitude_tests_slug ON public.aptitude_tests(slug);
CREATE INDEX idx_instructors_user ON public.instructors(user_id);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_path_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptitude_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptitude_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aptitude_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;

-- Public read policies (categories, subjects, courses, career paths, etc.)
CREATE POLICY "Anyone can view categories" ON public.course_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can view active instructors" ON public.instructors FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (is_published = true);
CREATE POLICY "Anyone can view modules of published courses" ON public.course_modules FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_modules.course_id AND courses.is_published = true));
CREATE POLICY "Anyone can view preview lessons" ON public.course_lessons FOR SELECT 
  USING (is_preview = true OR EXISTS (
    SELECT 1 FROM public.course_modules m 
    JOIN public.courses c ON c.id = m.course_id 
    WHERE m.id = course_lessons.module_id AND m.is_trial = true AND c.is_published = true
  ));
CREATE POLICY "Anyone can view assessments info" ON public.course_assessments FOR SELECT USING (true);
CREATE POLICY "Anyone can view career paths" ON public.career_paths FOR SELECT USING (true);
CREATE POLICY "Anyone can view career path courses" ON public.career_path_courses FOR SELECT USING (true);
CREATE POLICY "Anyone can view active aptitude tests" ON public.aptitude_tests FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view course reviews" ON public.course_reviews FOR SELECT USING (true);

-- Enrolled users can view full lessons
CREATE POLICY "Enrolled users can view all lessons" ON public.course_lessons FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.course_enrollments e 
    JOIN public.course_modules m ON m.course_id = e.course_id 
    WHERE m.id = course_lessons.module_id AND e.user_id = auth.uid() AND (e.credits_paid > 0 OR e.is_trial = false)
  ));

-- Premium users can view resources
CREATE POLICY "Premium users can view resources" ON public.lesson_resources FOR SELECT 
  USING (is_premium_only = false OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_premium = true
  ));

-- User-specific policies
CREATE POLICY "Users can view own enrollments" ON public.course_enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own enrollments" ON public.course_enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own enrollments" ON public.course_enrollments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own progress" ON public.lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.lesson_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own attempts" ON public.assessment_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.assessment_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON public.assessment_attempts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can verify certificates" ON public.certificates FOR SELECT USING (is_verified = true);

CREATE POLICY "Users can manage own reviews" ON public.course_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.course_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.course_reviews FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own aptitude results" ON public.aptitude_test_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own aptitude results" ON public.aptitude_test_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aptitude results" ON public.aptitude_test_results FOR UPDATE USING (auth.uid() = user_id);

-- Aptitude questions visible only during test
CREATE POLICY "Users can view test questions" ON public.aptitude_test_questions FOR SELECT USING (true);

-- Assessment questions visible to enrolled users
CREATE POLICY "Enrolled users can view assessment questions" ON public.assessment_questions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.course_assessments a 
    JOIN public.course_enrollments e ON e.course_id = a.course_id 
    WHERE a.id = assessment_questions.assessment_id AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own resumes" ON public.user_resumes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own saved courses" ON public.saved_courses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own notes" ON public.course_notes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own streaks" ON public.learning_streaks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions" ON public.instructor_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.instructor_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.instructor_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Instructor policies
CREATE POLICY "Instructors can manage own profile" ON public.instructors FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Instructors can manage own courses" ON public.courses FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.instructors WHERE instructors.id = courses.instructor_id AND instructors.user_id = auth.uid()));

CREATE POLICY "Instructors can manage own modules" ON public.course_modules FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.courses c 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE c.id = course_modules.course_id AND i.user_id = auth.uid()
  ));

CREATE POLICY "Instructors can manage own lessons" ON public.course_lessons FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.course_modules m 
    JOIN public.courses c ON c.id = m.course_id 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE m.id = course_lessons.module_id AND i.user_id = auth.uid()
  ));

CREATE POLICY "Instructors can manage own resources" ON public.lesson_resources FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.course_lessons l 
    JOIN public.course_modules m ON m.id = l.module_id 
    JOIN public.courses c ON c.id = m.course_id 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE l.id = lesson_resources.lesson_id AND i.user_id = auth.uid()
  ));

CREATE POLICY "Instructors can manage own assessments" ON public.course_assessments FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.courses c 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE c.id = course_assessments.course_id AND i.user_id = auth.uid()
  ));

CREATE POLICY "Instructors can manage own questions" ON public.assessment_questions FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.course_assessments a 
    JOIN public.courses c ON c.id = a.course_id 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE a.id = assessment_questions.assessment_id AND i.user_id = auth.uid()
  ));

CREATE POLICY "Instructors can view own payouts" ON public.instructor_payouts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.instructors WHERE instructors.id = instructor_payouts.instructor_id AND instructors.user_id = auth.uid()));

CREATE POLICY "Instructors can reply to reviews" ON public.course_reviews FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.courses c 
    JOIN public.instructors i ON i.id = c.instructor_id 
    WHERE c.id = course_reviews.course_id AND i.user_id = auth.uid()
  ));

-- =====================================================
-- TRIGGERS FOR AUTO-UPDATING COUNTS
-- =====================================================

-- Update course counts when modules change
CREATE OR REPLACE FUNCTION update_course_module_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_modules = total_modules + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_modules = total_modules - 1 WHERE id = OLD.course_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_module_change
AFTER INSERT OR DELETE ON public.course_modules
FOR EACH ROW EXECUTE FUNCTION update_course_module_count();

-- Update module lesson count
CREATE OR REPLACE FUNCTION update_module_lesson_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.course_modules SET total_lessons = total_lessons + 1 WHERE id = NEW.module_id;
    UPDATE public.courses SET total_lessons = total_lessons + 1 
    WHERE id = (SELECT course_id FROM public.course_modules WHERE id = NEW.module_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.course_modules SET total_lessons = total_lessons - 1 WHERE id = OLD.module_id;
    UPDATE public.courses SET total_lessons = total_lessons - 1 
    WHERE id = (SELECT course_id FROM public.course_modules WHERE id = OLD.module_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lesson_change
AFTER INSERT OR DELETE ON public.course_lessons
FOR EACH ROW EXECUTE FUNCTION update_module_lesson_count();

-- Update course enrollment count
CREATE OR REPLACE FUNCTION update_course_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_enrolled = total_enrolled + 1 WHERE id = NEW.course_id;
    UPDATE public.instructors SET total_students = total_students + 1 
    WHERE id = (SELECT instructor_id FROM public.courses WHERE id = NEW.course_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_enrolled = total_enrolled - 1 WHERE id = OLD.course_id;
    UPDATE public.instructors SET total_students = total_students - 1 
    WHERE id = (SELECT instructor_id FROM public.courses WHERE id = OLD.course_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_enrollment_change
AFTER INSERT OR DELETE ON public.course_enrollments
FOR EACH ROW EXECUTE FUNCTION update_course_enrollment_count();

-- Update course review stats
CREATE OR REPLACE FUNCTION update_course_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  review_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO avg_rating, review_count 
  FROM public.course_reviews 
  WHERE course_id = COALESCE(NEW.course_id, OLD.course_id);
  
  UPDATE public.courses SET 
    average_rating = COALESCE(avg_rating, 0),
    total_reviews = COALESCE(review_count, 0)
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
FOR EACH ROW EXECUTE FUNCTION update_course_review_stats();

-- Update instructor stats from reviews
CREATE OR REPLACE FUNCTION update_instructor_rating()
RETURNS TRIGGER AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_reviews INTEGER;
  instructor UUID;
BEGIN
  SELECT instructor_id INTO instructor FROM public.courses WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  
  SELECT AVG(cr.rating), COUNT(*) INTO avg_rating, total_reviews
  FROM public.course_reviews cr
  JOIN public.courses c ON c.id = cr.course_id
  WHERE c.instructor_id = instructor;
  
  UPDATE public.instructors SET 
    rating = COALESCE(avg_rating, 0),
    review_count = COALESCE(total_reviews, 0)
  WHERE id = instructor;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_update_instructor
AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
FOR EACH ROW EXECUTE FUNCTION update_instructor_rating();

-- Generate certificate number
CREATE OR REPLACE FUNCTION generate_certificate_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.certificate_number := 'FEEDIN-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_certificate_insert
BEFORE INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION generate_certificate_number();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.certificates;
