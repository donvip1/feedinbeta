import { useState } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CourseSearchProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: CourseFilters) => void;
  categories?: { id: string; name: string; slug: string }[];
  subjects?: { id: string; name: string; slug: string }[];
}

export interface CourseFilters {
  level?: string[];
  courseType?: string[];
  duration?: string;
  rating?: number;
  priceRange?: string;
  sortBy?: string;
}

export const CourseSearch = ({ 
  onSearch, 
  onFilterChange, 
  categories = [], 
  subjects = [] 
}: CourseSearchProps) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CourseFilters>({
    level: [],
    courseType: [],
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const updateFilter = (key: keyof CourseFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleArrayFilter = (key: 'level' | 'courseType', value: string) => {
    const current = filters[key] || [];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilter(key, newValue);
  };

  const clearFilters = () => {
    const emptyFilters: CourseFilters = { level: [], courseType: [] };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const activeFilterCount = 
    (filters.level?.length || 0) + 
    (filters.courseType?.length || 0) + 
    (filters.duration ? 1 : 0) + 
    (filters.rating ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search for courses, topics, or instructors..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => handleSearch('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          className="h-12 gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-card/50 rounded-lg border border-border/50">
          {/* Level Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Level
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover z-50">
              <DropdownMenuLabel>Skill Level</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {['beginner', 'intermediate', 'advanced', 'all-levels'].map(level => (
                <DropdownMenuCheckboxItem
                  key={level}
                  checked={filters.level?.includes(level)}
                  onCheckedChange={() => toggleArrayFilter('level', level)}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1).replace('-', ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Course Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                Type
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover z-50">
              <DropdownMenuLabel>Course Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {['certificate', 'diploma', 'short-course'].map(type => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={filters.courseType?.includes(type)}
                  onCheckedChange={() => toggleArrayFilter('courseType', type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Duration Filter */}
          <Select 
            value={filters.duration} 
            onValueChange={(val) => updateFilter('duration', val)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="0-2">0-2 hours</SelectItem>
              <SelectItem value="2-5">2-5 hours</SelectItem>
              <SelectItem value="5-10">5-10 hours</SelectItem>
              <SelectItem value="10+">10+ hours</SelectItem>
            </SelectContent>
          </Select>

          {/* Rating Filter */}
          <Select 
            value={filters.rating?.toString()} 
            onValueChange={(val) => updateFilter('rating', parseInt(val))}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="4">4+ stars</SelectItem>
              <SelectItem value="3">3+ stars</SelectItem>
              <SelectItem value="2">2+ stars</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select 
            value={filters.sortBy} 
            onValueChange={(val) => updateFilter('sortBy', val)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive">
              <X className="w-4 h-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Active filters display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.level?.map(level => (
            <Badge key={level} variant="secondary" className="gap-1">
              {level}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleArrayFilter('level', level)} 
              />
            </Badge>
          ))}
          {filters.courseType?.map(type => (
            <Badge key={type} variant="secondary" className="gap-1">
              {type}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleArrayFilter('courseType', type)} 
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
