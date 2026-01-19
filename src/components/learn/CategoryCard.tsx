import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Code, Palette, TrendingUp, Heart, Brain, Globe, 
  Camera, Music, Briefcase, GraduationCap, Laptop, 
  Shield, Database, Smartphone, Cloud, Cpu
} from 'lucide-react';

interface CategoryCardProps {
  category: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    icon?: string;
    course_count?: number;
    is_featured?: boolean;
  };
  variant?: 'default' | 'compact' | 'large';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'code': Code,
  'palette': Palette,
  'trending-up': TrendingUp,
  'heart': Heart,
  'brain': Brain,
  'globe': Globe,
  'camera': Camera,
  'music': Music,
  'briefcase': Briefcase,
  'graduation-cap': GraduationCap,
  'laptop': Laptop,
  'shield': Shield,
  'database': Database,
  'smartphone': Smartphone,
  'cloud': Cloud,
  'cpu': Cpu,
};

const categoryColors: Record<string, string> = {
  'technology': 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  'business': 'from-green-500/20 to-emerald-500/20 border-green-500/30',
  'design': 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
  'health': 'from-red-500/20 to-orange-500/20 border-red-500/30',
  'science': 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30',
  'language': 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
  'marketing': 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
  'personal-development': 'from-teal-500/20 to-cyan-500/20 border-teal-500/30',
  'default': 'from-primary/20 to-accent/20 border-primary/30',
};

export const CategoryCard = ({ category, variant = 'default' }: CategoryCardProps) => {
  const navigate = useNavigate();
  const IconComponent = iconMap[category.icon || 'graduation-cap'] || GraduationCap;
  const colorClass = categoryColors[category.slug] || categoryColors['default'];

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/ai/learn/category/${category.slug}`)}
        className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r ${colorClass} border cursor-pointer transition-all`}
      >
        <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center">
          <IconComponent className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{category.name}</h4>
          <p className="text-xs text-muted-foreground">{category.course_count || 0} courses</p>
        </div>
      </motion.div>
    );
  }

  if (variant === 'large') {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        onClick={() => navigate(`/ai/learn/category/${category.slug}`)}
        className={`relative p-6 rounded-xl bg-gradient-to-br ${colorClass} border cursor-pointer group overflow-hidden`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-xl bg-background/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <IconComponent className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">{category.name}</h3>
          {category.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{category.description}</p>
          )}
          <p className="text-sm font-medium text-primary">{category.course_count || 0} courses</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/ai/learn/category/${category.slug}`)}
      className={`p-4 rounded-xl bg-gradient-to-br ${colorClass} border cursor-pointer group transition-all`}
    >
      <div className="w-12 h-12 rounded-lg bg-background/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <IconComponent className="w-6 h-6 text-primary" />
      </div>
      <h4 className="font-semibold mb-1">{category.name}</h4>
      <p className="text-sm text-muted-foreground">{category.course_count || 0} courses</p>
    </motion.div>
  );
};
