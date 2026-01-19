import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter, TrendingUp, Briefcase, DollarSign, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CareerPathCard } from '@/components/learn/CareerPathCard';
import { useCareerPaths } from '@/hooks/useLearnData';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const CareerPaths = () => {
  const navigate = useNavigate();
  const { data: careerPaths, isLoading } = useCareerPaths();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterCategory, setFilterCategory] = React.useState<string>('all');

  const filteredPaths = React.useMemo(() => {
    if (!careerPaths) return [];
    
    return careerPaths.filter(path => {
      const matchesSearch = path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        path.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || path.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [careerPaths, searchQuery, filterCategory]);

  const categories = React.useMemo(() => {
    if (!careerPaths) return [];
    const uniqueCategories = [...new Set(careerPaths.map(p => p.category).filter(Boolean))];
    return uniqueCategories as string[];
  }, [careerPaths]);

  const featuredPaths = filteredPaths.filter(p => p.is_featured);
  const trendingPaths = filteredPaths.filter(p => p.is_trending);
  const regularPaths = filteredPaths.filter(p => !p.is_featured && !p.is_trending);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Career Paths</h1>
            <p className="text-sm text-muted-foreground">Explore 1000+ career opportunities</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-3 text-center border border-primary/20"
          >
            <Briefcase className="w-6 h-6 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{careerPaths?.length || 0}+</p>
            <p className="text-xs text-muted-foreground">Careers</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl p-3 text-center border border-green-500/20"
          >
            <TrendingUp className="w-6 h-6 mx-auto mb-1 text-green-400" />
            <p className="text-lg font-bold">{trendingPaths.length}</p>
            <p className="text-xs text-muted-foreground">Trending</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl p-3 text-center border border-purple-500/20"
          >
            <GraduationCap className="w-6 h-6 mx-auto mb-1 text-purple-400" />
            <p className="text-lg font-bold">{categories.length}</p>
            <p className="text-xs text-muted-foreground">Industries</p>
          </motion.div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search career paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Featured Paths */}
            {featuredPaths.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold">Featured Careers</h2>
                  <Badge variant="secondary" className="bg-primary/20 text-primary">Hot</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredPaths.map((path, index) => (
                    <motion.div
                      key={path.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <CareerPathCard careerPath={path} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Trending Paths */}
            {trendingPaths.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <h2 className="text-lg font-semibold">Trending Now</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trendingPaths.map((path, index) => (
                    <motion.div
                      key={path.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <CareerPathCard careerPath={path} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* All Paths */}
            {regularPaths.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">All Career Paths</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularPaths.map((path, index) => (
                    <motion.div
                      key={path.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <CareerPathCard careerPath={path} />
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {filteredPaths.length === 0 && (
              <div className="text-center py-16">
                <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Career Paths Found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CareerPaths;
