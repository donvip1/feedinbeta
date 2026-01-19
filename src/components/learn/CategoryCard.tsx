import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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

// High-quality Unsplash images for categories
const categoryImages: Record<string, string> = {
  'technology': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
  'business': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=300&fit=crop',
  'design': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop',
  'health': 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=300&fit=crop',
  'science': 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=300&fit=crop',
  'language': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
  'marketing': 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400&h=300&fit=crop',
  'personal-development': 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=300&fit=crop',
  'programming': 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop',
  'data-science': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
  'ai-ml': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
  'finance': 'https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=400&h=300&fit=crop',
  'photography': 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&h=300&fit=crop',
  'music': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop',
  'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
  'lifestyle': 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=300&fit=crop',
};

const defaultImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop';

export const CategoryCard = ({ category, variant = 'default' }: CategoryCardProps) => {
  const navigate = useNavigate();
  const imageUrl = categoryImages[category.slug] || defaultImage;

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/ai/learn/category/${category.slug}`)}
        className="relative flex items-center gap-3 p-2 rounded-lg overflow-hidden cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
          <img 
            src={imageUrl} 
            alt={category.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground">{category.name}</h4>
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
        className="relative rounded-xl overflow-hidden aspect-[16/9] cursor-pointer group"
      >
        <img 
          src={imageUrl}
          alt={category.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-xl font-bold text-white mb-1">{category.name}</h3>
          {category.description && (
            <p className="text-sm text-white/80 line-clamp-2 mb-2">{category.description}</p>
          )}
          <p className="text-sm font-medium text-white/90">{category.course_count || 0} courses</p>
        </div>
      </motion.div>
    );
  }

  // Default variant - image-based card
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/ai/learn/category/${category.slug}`)}
      className="relative w-32 shrink-0 rounded-xl overflow-hidden aspect-[3/4] cursor-pointer group"
    >
      <img 
        src={imageUrl}
        alt={category.name}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h4 className="font-semibold text-white text-sm line-clamp-2">{category.name}</h4>
        <p className="text-xs text-white/80 mt-0.5">{category.course_count || 0} courses</p>
      </div>
    </motion.div>
  );
};
