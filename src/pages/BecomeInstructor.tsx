import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Users, Coins, Award, ChevronRight, 
  BookOpen, Video, CheckCircle, Star, TrendingUp 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BecomeInstructor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    expertise: '',
    experience: '',
    bio: '',
    linkedIn: '',
    portfolio: '',
  });

  const benefits = [
    { icon: Coins, title: 'Earn 70% Revenue', description: 'Keep 70% of all credits from course enrollments' },
    { icon: Users, title: 'Reach Millions', description: 'Access our global community of eager learners' },
    { icon: Award, title: 'Build Authority', description: 'Establish yourself as an industry expert' },
    { icon: TrendingUp, title: 'Passive Income', description: 'Earn while you sleep with evergreen content' },
  ];

  const requirements = [
    'Expertise in your subject area',
    'Ability to create engaging video content',
    'Commitment to student success',
    'Professional communication skills',
    'Original content (no plagiarism)',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please sign in to apply');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // TODO: Submit instructor application
      toast.success('Application submitted! We\'ll review it within 48 hours.');
      navigate('/ai/learn');
    } catch (error) {
      toast.error('Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Become an Instructor" onBack={() => navigate('/ai/learn')} />
      
      <div className="p-4 space-y-6">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Share Your Knowledge</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Join thousands of instructors earning credits by teaching what they love
          </p>
        </motion.div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full">
                <CardContent className="p-4 text-center">
                  <benefit.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-semibold text-sm mb-1">{benefit.title}</h3>
                  <p className="text-xs text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {requirements.map((req, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  {req}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Application Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Apply Now</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="expertise">Area of Expertise</Label>
                <Input
                  id="expertise"
                  placeholder="e.g., Web Development, Data Science"
                  value={formData.expertise}
                  onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  id="experience"
                  type="number"
                  placeholder="e.g., 5"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="bio">Brief Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself and your teaching experience..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="linkedin">LinkedIn Profile (optional)</Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/..."
                  value={formData.linkedIn}
                  onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="portfolio">Portfolio/Website (optional)</Label>
                <Input
                  id="portfolio"
                  placeholder="https://..."
                  value={formData.portfolio}
                  onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BecomeInstructor;
