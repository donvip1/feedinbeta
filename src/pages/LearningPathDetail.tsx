import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  BookOpen, Clock, Users, Award, Star, ChevronRight,
  CheckCircle, Lock, Play, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const LearningPathDetail = () => {
  const navigate = useNavigate();
  const { slug } = useParams();

  // Mock data - would be fetched based on slug
  const path = {
    id: 'frontend-dev',
    title: 'Frontend Developer',
    description: 'Master the fundamentals and advanced concepts of frontend web development. From HTML/CSS basics to React, TypeScript, and modern build tools.',
    icon: '💻',
    courses: 12,
    totalHours: 85,
    enrolledUsers: 15420,
    rating: 4.8,
    reviews: 2340,
    difficulty: 'Beginner to Advanced',
    estimatedWeeks: 12,
    skills: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Git', 'Testing'],
    pathRequirements: [
      'Basic computer skills',
      'No programming experience required',
      'A computer with internet access',
    ],
    outcomes: [
      'Build responsive, modern websites',
      'Create interactive web applications with React',
      'Work with APIs and handle data',
      'Deploy applications to production',
      'Collaborate using Git and GitHub',
    ],
    pathCourses: [
      { id: '1', title: 'HTML & CSS Fundamentals', duration: '8h', completed: true, free: true },
      { id: '2', title: 'JavaScript Essentials', duration: '12h', completed: true, free: false },
      { id: '3', title: 'Advanced JavaScript', duration: '10h', completed: false, free: false },
      { id: '4', title: 'React Basics', duration: '8h', completed: false, free: false },
      { id: '5', title: 'React Hooks & State', duration: '6h', completed: false, free: false },
      { id: '6', title: 'TypeScript for React', duration: '7h', completed: false, free: false },
      { id: '7', title: 'Testing with Jest', duration: '5h', completed: false, free: false },
      { id: '8', title: 'Build Tools & Deployment', duration: '6h', completed: false, free: false },
    ],
    progress: 25,
    completedCourses: 2,
  };

  const totalCredits = 280; // Sum of all course credits

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Learning Path" onBack={() => navigate('/ai/learn/paths')} />
      
      <div className="p-4 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="p-6 text-center">
              <div className="text-5xl mb-4">{path.icon}</div>
              <h1 className="text-2xl font-bold mb-2">{path.title}</h1>
              <p className="text-muted-foreground text-sm mb-4">{path.description}</p>
              
              <div className="flex justify-center gap-6 text-sm mb-4">
                <div className="text-center">
                  <div className="font-bold">{path.pathCourses.length}</div>
                  <div className="text-xs text-muted-foreground">Courses</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{path.totalHours}h</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="font-bold flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" /> {path.rating}
                  </div>
                  <div className="text-xs text-muted-foreground">{path.reviews} reviews</div>
                </div>
              </div>

              {path.progress > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Your Progress</span>
                    <span>{path.completedCourses}/{path.pathCourses.length} courses</span>
                  </div>
                  <Progress value={path.progress} className="h-3" />
                </div>
              )}

              <Badge className="mb-4">{path.difficulty}</Badge>
            </CardContent>
          </Card>
        </motion.div>

        {/* Skills You'll Learn */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Skills You'll Master</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {path.skills.map(skill => (
                <Badge key={skill} variant="secondary">{skill}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What You'll Learn */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What You'll Achieve</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {path.outcomes.map((outcome, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {outcome}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Course List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Path Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {path.pathCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  course.completed 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-muted/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  course.completed ? 'bg-green-500 text-white' : 'bg-muted'
                }`}>
                  {course.completed ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm">{course.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {course.duration}
                    {course.free && <Badge variant="secondary" className="text-xs">Free</Badge>}
                  </div>
                </div>

                <Button 
                  variant={course.completed ? 'ghost' : 'outline'} 
                  size="sm"
                  onClick={() => navigate(`/ai/learn/course/${course.id}`)}
                >
                  {course.completed ? 'Review' : 'Start'}
                </Button>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {path.pathRequirements.map((req, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">
                  {path.progress > 0 ? 'Continue Learning' : 'Start This Path'}
                </h3>
                <p className="text-sm opacity-90">
                  {path.progress > 0 
                    ? `Pick up where you left off` 
                    : `${path.pathCourses.length} courses • ${path.estimatedWeeks} weeks`}
                </p>
              </div>
              <Button variant="secondary" onClick={() => {
                const nextCourse = path.pathCourses.find(c => !c.completed);
                if (nextCourse) {
                  navigate(`/ai/learn/course/${nextCourse.id}`);
                }
              }}>
                <Play className="w-4 h-4 mr-1" />
                {path.progress > 0 ? 'Continue' : 'Begin'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LearningPathDetail;
