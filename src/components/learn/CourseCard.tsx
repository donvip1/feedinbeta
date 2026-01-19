import { motion } from 'framer-motion';
import { Star, Users, Clock, BookOpen, Award, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface CourseCardProps {
  course: {
    id: string;
    slug: string;
    title: string;
    short_description?: string;
    description?: string;
    thumbnail_url?: string;
    level?: string;
    course_type?: string;
    duration_hours?: number;
    credit_cost: number;
    total_enrolled?: number;
    average_rating?: number;
    total_reviews?: number;
    is_bestseller?: boolean;
    is_new?: boolean;
    is_featured?: boolean;
    instructor?: {
      user_id: string;
      profiles?: {
        display_name?: string;
        avatar_url?: string;
      };
    };
    instructors?: {
      profiles?: {
        display_name?: string;
        avatar_url?: string;
      };
    };
  };
  variant?: 'default' | 'compact' | 'featured' | 'horizontal' | 'detailed';
}

export const CourseCard = ({ course, variant = 'default' }: CourseCardProps) => {
  const navigate = useNavigate();
  
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-500/20 text-green-400';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400';
      case 'advanced': return 'bg-red-500/20 text-red-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

  const formatDuration = (hours?: number) => {
    if (!hours) return 'Self-paced';
    if (hours < 1) return `${Math.round(hours * 60)} mins`;
    return `${hours.toFixed(1)} hrs`;
  };

  const instructorName = course.instructor?.profiles?.display_name || 
    course.instructors?.profiles?.display_name || 'Instructor';

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={() => navigate(`/ai/learn/course/${course.slug}`)}
        className="flex gap-3 p-3 bg-card/50 rounded-lg border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
      >
        <div className="w-20 h-14 rounded overflow-hidden flex-shrink-0 bg-muted">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm line-clamp-1">{course.title}</h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {course.average_rating?.toFixed(1) || '0.0'}
            </span>
            <span>•</span>
            <span>{course.total_enrolled?.toLocaleString() || 0} students</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-sm font-semibold text-primary">{course.credit_cost} credits</span>
        </div>
      </motion.div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={() => navigate(`/ai/learn/course/${course.slug}`)}
        className="flex gap-4 p-4 bg-card rounded-xl border border-border/50 cursor-pointer hover:border-primary/30 transition-all group"
      >
        <div className="w-48 h-28 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <BookOpen className="w-10 h-10 text-primary/50" />
            </div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            {course.is_bestseller && (
              <Badge className="bg-yellow-500 text-black text-xs">Bestseller</Badge>
            )}
            {course.course_type === 'diploma' && (
              <Badge className="bg-purple-500/90 text-white text-xs flex items-center gap-1">
                <Award className="w-3 h-3" /> Diploma
              </Badge>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-semibold text-base line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-muted-foreground mb-2">{instructorName}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {course.average_rating?.toFixed(1) || '0.0'} ({course.total_reviews || 0})
            </span>
            <span>•</span>
            <span>{formatDuration(course.duration_hours)}</span>
            <span>•</span>
            <Badge variant="outline" className={`text-xs ${getLevelColor(course.level)}`}>
              {course.level || 'All levels'}
            </Badge>
          </div>
          <div className="mt-auto flex items-center justify-between">
            <span className="text-lg font-bold text-primary">{course.credit_cost} credits</span>
            <span className="text-xs text-muted-foreground">{course.total_enrolled?.toLocaleString() || 0} students</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'detailed') {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={() => navigate(`/ai/learn/course/${course.slug}`)}
        className="flex gap-5 p-5 bg-card rounded-xl border border-border/50 cursor-pointer hover:border-primary/30 transition-all group"
      >
        <div className="w-64 h-36 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <BookOpen className="w-12 h-12 text-primary/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="absolute top-2 left-2 flex gap-1">
            {course.is_bestseller && (
              <Badge className="bg-yellow-500 text-black text-xs">Bestseller</Badge>
            )}
            {course.is_new && (
              <Badge className="bg-green-500 text-white text-xs">New</Badge>
            )}
          </div>
          {course.course_type === 'diploma' && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-purple-500/90 text-white text-xs flex items-center gap-1">
                <Award className="w-3 h-3" /> Diploma
              </Badge>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-bold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          {(course.short_description || course.description) && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {course.short_description || course.description}
            </p>
          )}
          <p className="text-xs text-muted-foreground mb-2">{instructorName}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{course.average_rating?.toFixed(1) || '0.0'}</span>
              ({course.total_reviews?.toLocaleString() || 0} reviews)
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {course.total_enrolled?.toLocaleString() || 0} students
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(course.duration_hours)}
            </span>
            <Badge variant="outline" className={`text-xs ${getLevelColor(course.level)}`}>
              {course.level || 'All levels'}
            </Badge>
          </div>
          <div className="mt-auto flex items-center justify-between pt-3">
            <span className="text-xl font-bold text-primary">{course.credit_cost} credits</span>
            <Button size="sm">Enroll Now</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={() => navigate(`/ai/learn/course/${course.slug}`)}
        className="relative group cursor-pointer rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30"
      >
        <div className="aspect-video relative">
          {course.thumbnail_url ? (
            <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-accent/30">
              <BookOpen className="w-16 h-16 text-primary/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex gap-2">
            {course.is_bestseller && (
              <Badge className="bg-yellow-500 text-black">Bestseller</Badge>
            )}
            {course.is_new && (
              <Badge className="bg-green-500 text-white">New</Badge>
            )}
            {course.course_type === 'diploma' && (
              <Badge className="bg-purple-500 text-white flex items-center gap-1">
                <Award className="w-3 h-3" /> Diploma
              </Badge>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{course.title}</h3>
            <p className="text-sm text-white/80 line-clamp-2 mb-3">{course.short_description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-white/80 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  {course.average_rating?.toFixed(1) || '0.0'} ({course.total_reviews || 0})
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {course.total_enrolled?.toLocaleString() || 0}
                </span>
              </div>
              <Button size="sm" className="gap-2">
                <Play className="w-4 h-4" />
                Preview
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }}
      onClick={() => navigate(`/ai/learn/course/${course.slug}`)}
      className="group cursor-pointer bg-card rounded-xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all"
    >
      <div className="aspect-video relative overflow-hidden">
        {course.thumbnail_url ? (
          <img 
            src={course.thumbnail_url} 
            alt={course.title} 
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <BookOpen className="w-12 h-12 text-primary/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="absolute top-2 left-2 flex gap-1.5">
          {course.is_bestseller && (
            <Badge className="bg-yellow-500 text-black text-xs">Bestseller</Badge>
          )}
          {course.is_new && (
            <Badge className="bg-green-500 text-white text-xs">New</Badge>
          )}
        </div>
        {course.course_type === 'diploma' && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-purple-500/90 text-white text-xs flex items-center gap-1">
              <Award className="w-3 h-3" /> Diploma
            </Badge>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        
        <p className="text-xs text-muted-foreground mb-2">
          {instructorName}
        </p>
        
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{course.average_rating?.toFixed(1) || '0.0'}</span>
          </div>
          <span className="text-xs text-muted-foreground">({course.total_reviews?.toLocaleString() || 0} reviews)</span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(course.duration_hours)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {course.total_enrolled?.toLocaleString() || 0}
          </span>
          <Badge variant="outline" className={`text-xs ${getLevelColor(course.level)}`}>
            {course.level || 'All levels'}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <span className="text-lg font-bold text-primary">{course.credit_cost} credits</span>
          <Button size="sm" variant="ghost" className="text-xs">
            View Course
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
