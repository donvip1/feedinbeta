import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, DollarSign, BookOpen, ArrowRight } from 'lucide-react';
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

// High-quality images for career paths
const careerImages: Record<string, string> = {
  'web-developer': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&h=400&fit=crop',
  'data-scientist': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop',
  'ux-designer': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop',
  'cloud-engineer': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop',
  'product-manager': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&h=400&fit=crop',
  'cybersecurity': 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&h=400&fit=crop',
  'mobile-developer': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&h=400&fit=crop',
  'machine-learning': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop',
  'digital-marketing': 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=600&h=400&fit=crop',
  'devops': 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=600&h=400&fit=crop',
  'blockchain': 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600&h=400&fit=crop',
  'game-developer': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&h=400&fit=crop',
};

const defaultCareerImage = 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&h=400&fit=crop';

export const CareerPathCard = ({ careerPath, variant = 'default' }: CareerPathCardProps) => {
  const navigate = useNavigate();
  const imageUrl = careerImages[careerPath.slug] || defaultCareerImage;

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
        className="relative flex items-center gap-3 p-2 rounded-lg overflow-hidden cursor-pointer group"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0">
          <img 
            src={imageUrl}
            alt={careerPath.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-foreground">{careerPath.title}</h4>
            {careerPath.is_trending && (
              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-400">
                <TrendingUp className="w-3 h-3 mr-1" />
                Hot
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
        className="relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer group"
      >
        <img 
          src={imageUrl}
          alt={careerPath.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {careerPath.is_trending && (
            <Badge className="bg-orange-500 text-white border-0">
              <TrendingUp className="w-3 h-3 mr-1" />
              Trending
            </Badge>
          )}
          {careerPath.is_featured && (
            <Badge className="bg-primary text-primary-foreground border-0">Featured</Badge>
          )}
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-lg font-bold text-white mb-1">{careerPath.title}</h3>
          {careerPath.description && (
            <p className="text-sm text-white/80 line-clamp-2 mb-3">{careerPath.description}</p>
          )}
          
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-white/90">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium">
                {formatSalary(careerPath.salary_range_min, careerPath.salary_range_max, careerPath.salary_currency)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-white/90">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm">{careerPath.total_courses || 0} courses</span>
            </div>
          </div>
          
          {careerPath.skills_required && careerPath.skills_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {careerPath.skills_required.slice(0, 3).map((skill, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-white/10 text-white border-white/30">
                  {skill}
                </Badge>
              ))}
            </div>
          )}
          
          <Button className="w-full gap-2 group-hover:gap-3 transition-all" size="sm">
            Explore Career
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  // Default variant - image-based card
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/ai/learn/careers/${careerPath.slug}`)}
      className="relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer group"
    >
      <img 
        src={imageUrl}
        alt={careerPath.title}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      
      {/* Trending badge */}
      {careerPath.is_trending && (
        <Badge className="absolute top-3 right-3 bg-orange-500 text-white border-0">
          <TrendingUp className="w-3 h-3 mr-1" />
          Hot
        </Badge>
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-semibold text-lg text-white mb-1">{careerPath.title}</h3>
        
        {careerPath.category && (
          <p className="text-sm text-white/70 mb-2">{careerPath.category}</p>
        )}
        
        <div className="flex items-center gap-3 text-sm mb-2">
          <div className="flex items-center gap-1 text-green-400">
            <DollarSign className="w-4 h-4" />
            <span className="font-medium text-white">
              {formatSalary(careerPath.salary_range_min, careerPath.salary_range_max, careerPath.salary_currency)}
            </span>
          </div>
        </div>
        
        {careerPath.skills_required && careerPath.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {careerPath.skills_required.slice(0, 2).map((skill, i) => (
              <Badge key={i} variant="outline" className="text-xs bg-white/10 text-white/90 border-white/20">
                {skill}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-white/20">
          <span className="text-sm text-white/80">
            {careerPath.total_courses || 0} courses
          </span>
          <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </motion.div>
  );
};
