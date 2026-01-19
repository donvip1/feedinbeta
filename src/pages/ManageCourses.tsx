import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Plus, Edit, Trash2, Eye, EyeOff, 
  Users, Star, Coins, MoreVertical, Search 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const ManageCourses = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Mock data
  const courses = [
    {
      id: '1',
      title: 'Complete React Developer Course 2024',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400',
      status: 'published',
      students: 450,
      rating: 4.8,
      reviews: 89,
      earnings: 5400,
      creditCost: 40,
    },
    {
      id: '2',
      title: 'TypeScript Essentials for Beginners',
      thumbnail: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=400',
      status: 'published',
      students: 320,
      rating: 4.6,
      reviews: 54,
      earnings: 3840,
      creditCost: 35,
    },
    {
      id: '3',
      title: 'Advanced Node.js Backend Development',
      thumbnail: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=400',
      status: 'draft',
      students: 0,
      rating: 0,
      reviews: 0,
      earnings: 0,
      creditCost: 50,
    },
  ];

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = () => {
    toast.success('Course deleted successfully');
    setDeleteDialogOpen(false);
    setSelectedCourse(null);
  };

  const togglePublish = (courseId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'unpublished' : 'published';
    toast.success(`Course ${newStatus}`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="My Courses" onBack={() => navigate('/ai/learn/instructor/dashboard')} />
      
      <div className="p-4 space-y-4">
        {/* Search and Add */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => navigate('/ai/learn/instructor/create')}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Course List */}
        <div className="space-y-3">
          {filteredCourses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2">{course.title}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/ai/learn/instructor/course/${course.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => togglePublish(course.id, course.status)}>
                              {course.status === 'published' ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" /> Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" /> Publish
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedCourse(course.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                          {course.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {course.creditCost} credits
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {course.students}
                        </span>
                        {course.rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500" /> {course.rating}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <Coins className="w-3 h-3" /> {course.earnings}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filteredCourses.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No courses found</p>
              <Button className="mt-4" onClick={() => navigate('/ai/learn/instructor/create')}>
                <Plus className="w-4 h-4 mr-2" /> Create Your First Course
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All course content, student enrollments, and data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageCourses;
