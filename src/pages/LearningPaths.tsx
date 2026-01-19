import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Route, BookOpen, Clock, Award, ChevronRight, 
  Search, Filter, TrendingUp, Star 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const LearningPaths = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const paths = [
    {
      id: 'frontend-dev',
      title: 'Frontend Developer',
      description: 'Master HTML, CSS, JavaScript, React, and modern frontend tools',
      icon: '💻',
      courses: 12,
      totalHours: 85,
      enrolledUsers: 15420,
      rating: 4.8,
      difficulty: 'Beginner to Advanced',
      skills: ['HTML/CSS', 'JavaScript', 'React', 'TypeScript'],
      progress: 35, // User's progress
    },
    {
      id: 'data-science',
      title: 'Data Scientist',
      description: 'Learn Python, statistics, machine learning, and data visualization',
      icon: '📊',
      courses: 15,
      totalHours: 120,
      enrolledUsers: 12850,
      rating: 4.9,
      difficulty: 'Intermediate',
      skills: ['Python', 'Statistics', 'ML', 'SQL'],
      progress: 0,
    },
    {
      id: 'mobile-dev',
      title: 'Mobile App Developer',
      description: 'Build iOS and Android apps with React Native and Flutter',
      icon: '📱',
      courses: 10,
      totalHours: 75,
      enrolledUsers: 9870,
      rating: 4.7,
      difficulty: 'Intermediate',
      skills: ['React Native', 'Flutter', 'Swift', 'Kotlin'],
      progress: 0,
    },
    {
      id: 'cloud-engineer',
      title: 'Cloud Engineer',
      description: 'Master AWS, Azure, GCP, and cloud architecture principles',
      icon: '☁️',
      courses: 14,
      totalHours: 100,
      enrolledUsers: 8540,
      rating: 4.8,
      difficulty: 'Advanced',
      skills: ['AWS', 'Azure', 'Docker', 'Kubernetes'],
      progress: 0,
    },
    {
      id: 'ui-ux-design',
      title: 'UI/UX Designer',
      description: 'Learn design thinking, Figma, and create stunning user experiences',
      icon: '🎨',
      courses: 8,
      totalHours: 55,
      enrolledUsers: 11230,
      rating: 4.9,
      difficulty: 'Beginner',
      skills: ['Figma', 'Design Systems', 'Prototyping', 'Research'],
      progress: 0,
    },
    {
      id: 'devops',
      title: 'DevOps Engineer',
      description: 'Master CI/CD, automation, and infrastructure as code',
      icon: '⚙️',
      courses: 11,
      totalHours: 80,
      enrolledUsers: 6780,
      rating: 4.7,
      difficulty: 'Advanced',
      skills: ['CI/CD', 'Terraform', 'Jenkins', 'Monitoring'],
      progress: 0,
    },
  ];

  const filteredPaths = paths.filter(path =>
    path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Learning Paths" onBack={() => navigate('/ai/learn')} />
      
      <div className="p-4 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search learning paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Featured Path */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30 overflow-hidden">
            <CardContent className="p-4">
              <Badge className="mb-2">Most Popular</Badge>
              <h2 className="text-xl font-bold mb-1">{paths[0].title}</h2>
              <p className="text-sm text-muted-foreground mb-3">{paths[0].description}</p>
              
              <div className="flex items-center gap-4 text-sm mb-3">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" /> {paths[0].courses} courses
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {paths[0].totalHours}h
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" /> {paths[0].rating}
                </span>
              </div>

              {paths[0].progress > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Your Progress</span>
                    <span>{paths[0].progress}%</span>
                  </div>
                  <Progress value={paths[0].progress} className="h-2" />
                </div>
              )}

              <Button className="w-full" onClick={() => navigate(`/ai/learn/paths/${paths[0].id}`)}>
                {paths[0].progress > 0 ? 'Continue Learning' : 'Start Path'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* All Paths */}
        <div>
          <h2 className="font-semibold mb-3">All Learning Paths</h2>
          <div className="space-y-3">
            {filteredPaths.slice(1).map((path, index) => (
              <motion.div
                key={path.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/ai/learn/paths/${path.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl flex-shrink-0">
                        {path.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{path.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {path.description}
                        </p>
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{path.courses} courses</span>
                          <span>{path.totalHours}h</span>
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500" /> {path.rating}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {path.skills.slice(0, 3).map(skill => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {path.skills.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{path.skills.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground self-center" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningPaths;
