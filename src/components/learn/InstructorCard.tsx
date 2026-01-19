import { motion } from 'framer-motion';
import { Star, Users, BookOpen, Award, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface InstructorCardProps {
  instructor: {
    id: string;
    user_id: string;
    bio?: string;
    expertise?: string[];
    qualifications?: string[];
    total_students?: number;
    total_courses?: number;
    rating?: number;
    review_count?: number;
    is_verified?: boolean;
    profiles?: {
      display_name?: string;
      username?: string;
      avatar_url?: string;
    };
  };
  variant?: 'default' | 'compact' | 'featured';
  onSubscribe?: () => void;
}

export const InstructorCard = ({ instructor, variant = 'default', onSubscribe }: InstructorCardProps) => {
  const navigate = useNavigate();
  const profile = instructor.profiles;

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={() => navigate(`/profile/${profile?.username || instructor.user_id}`)}
        className="flex items-center gap-3 p-3 bg-card/50 rounded-lg border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
      >
        <Avatar className="w-12 h-12">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback>{profile?.display_name?.[0] || 'I'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{profile?.display_name || 'Instructor'}</h4>
            {instructor.is_verified && (
              <CheckCircle className="w-4 h-4 text-blue-500 fill-blue-500" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {instructor.rating?.toFixed(1) || '0.0'}
            </span>
            <span>•</span>
            <span>{instructor.total_courses || 0} courses</span>
          </div>
        </div>
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        className="relative p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-primary/20 overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <Avatar className="w-20 h-20 border-4 border-primary/30">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="text-2xl">{profile?.display_name?.[0] || 'I'}</AvatarFallback>
          </Avatar>
          <div className="mt-4 flex items-center gap-2">
            <h3 className="text-lg font-bold">{profile?.display_name || 'Instructor'}</h3>
            {instructor.is_verified && (
              <CheckCircle className="w-5 h-5 text-blue-500 fill-blue-500" />
            )}
          </div>
          {instructor.expertise && instructor.expertise.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {instructor.expertise.slice(0, 2).join(' • ')}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-lg">{instructor.total_students?.toLocaleString() || 0}</div>
              <div className="text-xs text-muted-foreground">Students</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{instructor.total_courses || 0}</div>
              <div className="text-xs text-muted-foreground">Courses</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {instructor.rating?.toFixed(1) || '0.0'}
              </div>
              <div className="text-xs text-muted-foreground">Rating</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/profile/${profile?.username || instructor.user_id}`)}
            >
              View Profile
            </Button>
            {onSubscribe && (
              <Button size="sm" onClick={onSubscribe}>
                Subscribe
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-card rounded-xl border border-border/50 p-5 hover:border-primary/30 transition-all"
    >
      <div className="flex items-start gap-4">
        <Avatar 
          className="w-16 h-16 cursor-pointer"
          onClick={() => navigate(`/profile/${profile?.username || instructor.user_id}`)}
        >
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className="text-xl">{profile?.display_name?.[0] || 'I'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 
              className="font-semibold hover:text-primary cursor-pointer transition-colors"
              onClick={() => navigate(`/profile/${profile?.username || instructor.user_id}`)}
            >
              {profile?.display_name || 'Instructor'}
            </h3>
            {instructor.is_verified && (
              <CheckCircle className="w-4 h-4 text-blue-500 fill-blue-500" />
            )}
          </div>
          {instructor.expertise && instructor.expertise.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {instructor.expertise.slice(0, 3).join(' • ')}
            </p>
          )}
        </div>
      </div>
      
      {instructor.bio && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{instructor.bio}</p>
      )}
      
      <div className="grid grid-cols-3 gap-4 mt-4 py-4 border-t border-border/50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 font-semibold">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            {instructor.rating?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xs text-muted-foreground">Rating</div>
        </div>
        <div className="text-center">
          <div className="font-semibold flex items-center justify-center gap-1">
            <Users className="w-4 h-4 text-primary" />
            {instructor.total_students?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-muted-foreground">Students</div>
        </div>
        <div className="text-center">
          <div className="font-semibold flex items-center justify-center gap-1">
            <BookOpen className="w-4 h-4 text-primary" />
            {instructor.total_courses || 0}
          </div>
          <div className="text-xs text-muted-foreground">Courses</div>
        </div>
      </div>
      
      {instructor.qualifications && instructor.qualifications.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {instructor.qualifications.slice(0, 3).map((qual, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              <Award className="w-3 h-3 mr-1" />
              {qual}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex gap-2 mt-4">
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={() => navigate(`/profile/${profile?.username || instructor.user_id}`)}
        >
          View Profile
        </Button>
        {onSubscribe && (
          <Button className="flex-1" onClick={onSubscribe}>
            Subscribe
          </Button>
        )}
      </div>
    </motion.div>
  );
};
