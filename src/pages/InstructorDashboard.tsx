import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, Users, BookOpen, TrendingUp, Plus, 
  Eye, Star, Clock, ArrowRight 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Mock data - replace with real data
  const stats = {
    totalEarnings: 15420,
    thisMonth: 2340,
    totalStudents: 1250,
    totalCourses: 8,
    avgRating: 4.7,
    totalReviews: 324,
  };

  const recentCourses = [
    { id: '1', title: 'React Masterclass', students: 450, rating: 4.8, earnings: 5400 },
    { id: '2', title: 'TypeScript Essentials', students: 320, rating: 4.6, earnings: 3840 },
    { id: '3', title: 'Node.js Backend', students: 280, rating: 4.7, earnings: 3360 },
  ];

  const recentPayouts = [
    { date: '2024-01-15', amount: 1500, status: 'completed' },
    { date: '2024-01-01', amount: 1200, status: 'completed' },
    { date: '2023-12-15', amount: 980, status: 'completed' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Instructor Dashboard" onBack={() => navigate('/ai/learn')} />
      
      <div className="p-4 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
              <CardContent className="p-4">
                <Coins className="w-6 h-6 text-primary mb-2" />
                <div className="text-2xl font-bold">{stats.totalEarnings.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Earnings</div>
                <div className="text-xs text-green-500 mt-1">+{stats.thisMonth} this month</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <Users className="w-6 h-6 text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{stats.totalStudents.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Students</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-4">
                <BookOpen className="w-6 h-6 text-amber-500 mb-2" />
                <div className="text-2xl font-bold">{stats.totalCourses}</div>
                <div className="text-xs text-muted-foreground">Published Courses</div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-4">
                <Star className="w-6 h-6 text-yellow-500 mb-2" />
                <div className="text-2xl font-bold">{stats.avgRating}</div>
                <div className="text-xs text-muted-foreground">{stats.totalReviews} Reviews</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button className="flex-1 gap-2" onClick={() => navigate('/ai/learn/instructor/create')}>
            <Plus className="w-4 h-4" />
            New Course
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/ai/learn/instructor/courses')}>
            <Eye className="w-4 h-4" />
            My Courses
          </Button>
        </div>

        {/* Recent Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Your Courses</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/ai/learn/instructor/courses')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{course.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {course.students}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500" /> {course.rating}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary">{course.earnings}</div>
                  <div className="text-xs text-muted-foreground">credits</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Payouts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Payouts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPayouts.map((payout, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <div className="font-medium text-sm">{payout.amount} credits</div>
                  <div className="text-xs text-muted-foreground">{payout.date}</div>
                </div>
                <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                  {payout.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstructorDashboard;
