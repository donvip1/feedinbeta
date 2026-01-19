import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, BookOpen, Briefcase, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CareerPathCardProps {
  careerPath: {
    id: string;
    slug: string;
    title: string;
    description?: string;
    icon?: string;
    category?: string;
    salary_range_min?: number;
    salary_range_max?: number;
    salary_currency?: string;
    job_outlook?: string;
    growth_rate?: string;
    skills_required?: string[];
    is_featured?: boolean;
    is_trending?: boolean;
    total_courses?: number;
  };
  variant?: 'default' | 'compact' | 'featured';
}

export const CareerPathCard = ({ careerPath, variant = 'default' }: CareerPathCardProps) => {
  const navigate = useNavigate();

  const formatSalary = (min?: number, max?: number, currency?: string) => {
    if (!min && !max) return 'Varies';
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    });
    if (min && max) {
      return `${formatter.format(min)} - ${formatter.format(max)}`;
    }
    return formatter.format(min || max || 0);
  };

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={() => navigate(`/ai/learn/careers/${careerPath.slug}`)}
        className="flex items-center gap-3 p-3 bg-card/50 rounded-lg border border-border/50 cursor-pointer hover:border-primary/30 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{careerPath.title}</h4>
            {careerPath.is_trending && (
              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
                <TrendingUp className="w-3 h-3 mr-1" />
                Trending
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{careerPath.total_courses || 0} courses</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </motion.div>
    );
  }

  if (variant === 'featured') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        onClick={() => navigate(`/ai/learn/careers/${careerPath.slug}`)}
        className="relative p-6 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl border border-primary/30 cursor-pointer overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 rounded-xl bg-background/50 flex items-center justify-center">
              <Briefcase className="w-7 h-7 text-primary" />
            </div>
            <div className="flex gap-2">
              {careerPath.is_trending && (
                <Badge className="bg-orange-500 text-white">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Trending
                </Badge>
              )}
              {careerPath.is_featured && (
                <Badge className="bg-primary text-primary-foreground">Featured</Badge>
              )}
            </div>
          </div>
          
          <h3 className="text-xl font-bold mb-2">{careerPath.title}</h3>
          {careerPath.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{careerPath.description}</p>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">
                {formatSalary(careerPath.salary_range_min, careerPath.salary_range_max, careerPath.salary_currency)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm">{careerPath.total_courses || 0} courses</span>
            </div>
          </div>
          
          {careerPath.skills_required && careerPath.skills_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {careerPath.skills_required.slice(0, 4).map((skill, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {careerPath.skills_required.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{careerPath.skills_required.length - 4} more
                </Badge>
              )}
            </div>
          )}
          
          <Button className="w-full gap-2 group-hover:gap-3 transition-all">
            Explore Career Path
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/ai/learn/careers/${careerPath.slug}`)}
      className="bg-card rounded-xl border border-border/50 p-5 cursor-pointer hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <Briefcase className="w-6 h-6 text-primary" />
        </div>
        <div className="flex gap-1.5">
          {careerPath.is_trending && (
            <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending
            </Badge>
          )}
        </div>
      </div>
      
      <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
        {careerPath.title}
      </h3>
      
      {careerPath.category && (
        <p className="text-sm text-muted-foreground mb-3">{careerPath.category}</p>
      )}
      
      <div className="flex items-center gap-4 text-sm mb-4">
        <div className="flex items-center gap-1 text-green-500">
          <DollarSign className="w-4 h-4" />
          <span className="font-medium">
            {formatSalary(careerPath.salary_range_min, careerPath.salary_range_max, careerPath.salary_currency)}
          </span>
        </div>
      </div>
      
      {careerPath.job_outlook && (
        <p className="text-xs text-muted-foreground mb-3">{careerPath.job_outlook}</p>
      )}
      
      {careerPath.skills_required && careerPath.skills_required.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {careerPath.skills_required.slice(0, 3).map((skill, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {skill}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-sm text-muted-foreground">
          {careerPath.total_courses || 0} courses
        </span>
        <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.div>
  );
};
