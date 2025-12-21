import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, 
  HelpCircle, 
  MessageSquare, 
  Mail, 
  FileQuestion,
  Send,
  ExternalLink,
  BookOpen,
  Shield,
  Coins,
  Video,
  Users,
  GraduationCap
} from 'lucide-react';

const HelpSupport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const faqItems = [
    {
      question: 'How do I create a post?',
      answer: 'Tap the + button at the bottom of the screen to open the post creation menu. You can choose to capture from camera, select from gallery, or create a story.',
      icon: Video,
    },
    {
      question: 'How do credits work?',
      answer: 'Credits are the in-app currency used for premium features like AI tools, promotions, and sending gifts. You can purchase credits or earn them through daily bonuses and engagement.',
      icon: Coins,
    },
    {
      question: 'How do I go live?',
      answer: 'Navigate to the Live section from the feed header or bottom navigation. Tap "Go Live" to start broadcasting. You can invite friends and receive gifts from viewers.',
      icon: Video,
    },
    {
      question: 'How do I add friends?',
      answer: 'Go to the Friends section, search for users by username, and send them a friend request. Once accepted, you can message each other directly.',
      icon: Users,
    },
    {
      question: 'What is Learn Tech?',
      answer: 'Learn Tech is our integrated education platform where you can learn programming, web development, data science, AI/ML, mobile development, and more through structured courses and hands-on projects.',
      icon: GraduationCap,
    },
    {
      question: 'How do I enroll in Learn Tech courses?',
      answer: 'Go to Learn Tech from the AI menu or settings. Browse available courses by category, click on any course to view details, and tap "Enroll Now" to start learning. Some courses may require credits.',
      icon: GraduationCap,
    },
    {
      question: 'How do I report inappropriate content?',
      answer: 'Tap the three dots (...) on any post, comment, or profile and select "Report". Choose the appropriate reason and submit. Our moderation team will review it.',
      icon: Shield,
    },
    {
      question: 'How do I change my privacy settings?',
      answer: 'Go to Settings > Privacy Settings. Here you can control who can see your profile, send you messages, and view your online status.',
      icon: Shield,
    },
  ];

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in both subject and message fields.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // In production, this would send to a support system
      // For now, we'll show a success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Message Sent',
        description: 'Our support team will respond within 24-48 hours.',
      });
      
      setSubject('');
      setMessage('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <HelpCircle className="w-5 h-5 text-primary" />
            <span className="text-xl font-bold">Help & Support</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        {/* Quick Links */}
        <Card className="bg-card border-border p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Quick Help
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => navigate('/settings/privacy')}
            >
              <Shield className="w-5 h-5 text-purple-500" />
              <span className="text-sm">Privacy Guide</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => navigate('/wallet')}
            >
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-sm">Credits Help</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => navigate('/live')}
            >
              <Video className="w-5 h-5 text-red-500" />
              <span className="text-sm">Live Streaming</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2"
              onClick={() => navigate('/friends')}
            >
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-sm">Friends Guide</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 col-span-2"
              onClick={() => navigate('/learn-tech')}
            >
              <GraduationCap className="w-5 h-5 text-green-500" />
              <span className="text-sm">Learn Tech</span>
            </Button>
          </div>
        </Card>

        {/* FAQ Section */}
        <Card className="bg-card border-border p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-primary" />
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pl-7">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        {/* Contact Form */}
        <Card className="bg-card border-border p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Contact Support
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Can't find what you're looking for? Send us a message and we'll get back to you.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What can we help you with?"
                className="bg-background"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or question..."
                className="bg-background min-h-[120px]"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-primary"
            >
              {loading ? (
                'Sending...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Contact Info */}
        <Card className="bg-card border-border p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Other Ways to Reach Us
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium">Email Support</p>
                  <p className="text-sm text-muted-foreground">support@feedin.app</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Response time: 24-48 hours
            </p>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default HelpSupport;
