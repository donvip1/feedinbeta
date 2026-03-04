import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, FileText, Shield, Users, Scale, ExternalLink } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const sections = [
  {
    id: 'terms',
    title: 'Terms of Service',
    icon: Scale,
    color: 'text-blue-500',
    content: `By creating an account or using FeedIn, you confirm that you have read, understood, and agreed to our Terms of Service. FeedIn is a digital ecosystem designed to support social interaction, content creation, creator monetization, education, business tools, and AI-powered services.

Key points:
• You retain ownership of content you create and post on FeedIn
• Credits are not legal tender and have no value outside FeedIn
• All credit purchases are final and non-refundable except where required by law
• Subscriptions renew automatically unless canceled before the renewal date
• FeedIn is provided on an "as-is" and "as-available" basis
• This Agreement is governed by the laws of the Federal Republic of Nigeria`,
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    icon: Shield,
    color: 'text-green-500',
    content: `FeedIn is committed to protecting your personal data and respecting your privacy. We collect information you provide directly, data generated through your use of the Platform, and information from third-party sources.

Key points:
• We collect account info, content data, usage data, device info, and payment data
• Your data is used to operate, personalize, and improve the Platform
• We implement industry-standard security measures to protect your data
• You have rights to access, correct, delete, and port your personal data
• We may share data with service providers, legal authorities, and during business transfers
• We use cookies and similar technologies for functionality and analytics`,
  },
  {
    id: 'community',
    title: 'Community Guidelines',
    icon: Users,
    color: 'text-purple-500',
    content: `FeedIn is built to be a safe, respectful, and creative space. These guidelines apply to all users, content, interactions, and features.

Our principles:
• Respect for people and cultures
• Safety for all users, especially minors
• Authentic expression and creativity
• Fairness in monetization and engagement
• Responsible use of technology and AI

Prohibited content includes harassment, hate speech, violence, illegal activities, spam, misinformation, and exploitation of minors. Violations may result in content removal, account restrictions, or permanent bans.`,
  },
];

const AboutFeedIn = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get('section');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (activeSection) {
      const el = document.getElementById(activeSection);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    }
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <img src={feedinLogo} alt="FeedIn" className="w-8 h-8" />
            <h1 className="text-xl font-bold">About FeedIn</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        {/* App Info Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-lg mb-6">
          <div className="p-6 text-center">
            <img src={feedinLogo} alt="FeedIn" className="w-16 h-16 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-foreground">FeedIn</h2>
            <p className="text-sm text-muted-foreground mt-1">Version 1.0.0</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              A digital ecosystem for social interaction, content creation, education, and creator monetization.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Effective Date: 28 January 2026 · Last Updated: 29 January 2026
            </p>
          </div>
        </Card>

        {/* Policy Sections */}
        {sections.map((section) => (
          <Card
            key={section.id}
            id={section.id}
            className="bg-card/50 backdrop-blur-sm border-border shadow-md mb-4 scroll-mt-20"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`${section.color} bg-secondary/40 p-2.5 rounded-xl`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-foreground">{section.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {section.content}
              </p>
            </div>
          </Card>
        ))}

        {/* Download Full Document */}
        <Card className="bg-card/50 backdrop-blur-sm border-border shadow-md mb-4">
          <div className="p-5 sm:p-6">
            <a
              href="/docs/feedin-policies.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="text-amber-500 bg-secondary/40 p-2.5 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Full Policy Document</h3>
                  <p className="text-sm text-muted-foreground">View or download the complete PDF</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground space-y-1">
          <p>© {new Date().getFullYear()} FeedIn. All rights reserved.</p>
          <p>Governed by the laws of the Federal Republic of Nigeria</p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default AboutFeedIn;
