import { ArrowLeft, TrendingUp, Shield, Scale, Server, Users, HelpCircle, Mail, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Investors = () => {
  const navigate = useNavigate();

  const risks = [
    {
      icon: TrendingUp,
      title: "Market Risks",
      items: [
        "Competition from established platforms (TikTok, Instagram, YouTube)",
        "User adoption uncertainty in a crowded social media landscape",
        "Changing user preferences and platform fatigue",
        "Network effects favoring incumbents"
      ]
    },
    {
      icon: Server,
      title: "Technical Risks",
      items: [
        "Scalability challenges as user base grows",
        "Third-party service dependencies (Stripe, AI providers)",
        "Real-time infrastructure requirements for live streaming",
        "Mobile performance optimization needs"
      ]
    },
    {
      icon: Scale,
      title: "Financial Risks",
      items: [
        "Revenue model validation still in progress",
        "Credit economy requires careful balance management",
        "Customer acquisition costs in competitive market",
        "Path to profitability timeline uncertainty"
      ]
    },
    {
      icon: Shield,
      title: "Regulatory Risks",
      items: [
        "Evolving social media regulations globally",
        "Data privacy compliance (GDPR, CCPA)",
        "Content moderation legal requirements",
        "Payment and financial regulations for credit system"
      ]
    },
    {
      icon: Users,
      title: "Operational Risks",
      items: [
        "Team scaling requirements for growth",
        "Content moderation at scale challenges",
        "Creator retention and satisfaction",
        "Platform abuse and fraud prevention"
      ]
    }
  ];

  const faqs = [
    {
      question: "What makes FeedIn different from TikTok/Instagram?",
      answer: "FeedIn prioritizes creator monetization from day one with our built-in credit economy. Unlike platforms that require follower thresholds, any creator can earn immediately through gifts, tips, and premium content. We also integrate AI tools directly into the platform."
    },
    {
      question: "How does the credit economy work?",
      answer: "Users purchase credits which can be used to send gifts to creators, access premium content, use AI features, and promote posts. Creators earn credits from their audience and can cash out. The platform takes a small transaction fee, creating sustainable revenue."
    },
    {
      question: "What's the monetization strategy?",
      answer: "Multiple revenue streams: credit package purchases (primary), premium subscriptions, transaction fees on gifts and P2P trading, promoted content, and AI feature usage fees. This diversified approach reduces dependency on any single revenue source."
    },
    {
      question: "How is user data protected?",
      answer: "We implement Row Level Security (RLS) on all database tables, encrypted authentication, secure payment processing via Stripe, and comprehensive content moderation. We're building toward GDPR and CCPA compliance."
    },
    {
      question: "What's the current traction?",
      answer: "FeedIn is in active development with a fully functional MVP including social feed, stories, live streaming, messaging, groups, and AI features. We're preparing for beta launch and initial user acquisition."
    },
    {
      question: "What are potential exit strategies?",
      answer: "Possible exits include acquisition by larger social/tech companies seeking creator-focused platforms, strategic acquisition by media companies, or growth toward IPO. The creator economy space has seen significant M&A activity."
    },
    {
      question: "What's the investment being used for?",
      answer: "Funds will be allocated to: engineering team expansion (40%), marketing and user acquisition (30%), infrastructure and scaling (20%), and legal/compliance (10%). Specific allocations may vary based on growth stage."
    },
    {
      question: "What's the competitive moat?",
      answer: "Our moat includes: integrated credit economy creating switching costs, AI-powered features enhancing user experience, early mover advantage in creator-first monetization, and a unified platform reducing fragmentation for users."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Investor Information</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-24 space-y-8">
        {/* Hero Section */}
        <div className="text-center py-8 space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Invest in FeedIn
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join us in building the future of creator monetization. A social platform where every creator can earn from day one.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button onClick={() => window.open('mailto:invest@feedin.app', '_blank')}>
              <Mail className="h-4 w-4 mr-2" />
              Contact Us
            </Button>
            <Button variant="outline" onClick={() => navigate('/investors')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Pitch Deck
            </Button>
          </div>
        </div>

        {/* Risk Disclosure Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h3 className="text-2xl font-bold">Risk Disclosure</h3>
          </div>
          <p className="text-muted-foreground">
            Investing in early-stage companies carries significant risk. Please carefully consider the following before making any investment decision.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            {risks.map((risk, index) => (
              <Card key={index} className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <risk.icon className="h-5 w-5 text-primary" />
                    {risk.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {risk.items.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive-foreground">
                <strong>Important:</strong> This is not financial advice. Early-stage investments can result in total loss of capital. Only invest what you can afford to lose. Past performance does not guarantee future results.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h3 className="text-2xl font-bold">Investor FAQ</h3>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact Section */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center space-y-4">
            <h4 className="text-xl font-semibold">Interested in Learning More?</h4>
            <p className="text-muted-foreground">
              Schedule a call with our team to discuss investment opportunities and get detailed financial projections.
            </p>
            <Button size="lg" onClick={() => window.open('mailto:invest@feedin.app', '_blank')}>
              <Mail className="h-4 w-4 mr-2" />
              Schedule a Meeting
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Investors;
