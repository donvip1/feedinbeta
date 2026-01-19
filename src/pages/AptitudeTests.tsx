import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Clock, Coins, Trophy, Target, BarChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAptitudeTests } from '@/hooks/useLearnData';
import { Skeleton } from '@/components/ui/skeleton';

const AptitudeTests = () => {
  const navigate = useNavigate();
  const { data: tests, isLoading } = useAptitudeTests();

  const testTypeIcons: Record<string, string> = {
    verbal: '📝',
    numerical: '🔢',
    logical: '🧩',
    abstract: '🎨',
    spatial: '📐',
    mechanical: '⚙️',
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Aptitude Tests</h1>
            <p className="text-sm text-muted-foreground">Discover your strengths</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/20 via-card to-accent/10 rounded-2xl p-6 border"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Assess Your Skills</h2>
              <p className="text-muted-foreground text-sm">
                Take professional aptitude tests to understand your strengths and get personalized career recommendations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <Target className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-semibold">{tests?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Tests</p>
            </div>
            <div className="text-center">
              <Clock className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-semibold">15-30</p>
              <p className="text-xs text-muted-foreground">Minutes</p>
            </div>
            <div className="text-center">
              <Trophy className="w-6 h-6 mx-auto mb-1 text-primary" />
              <p className="text-sm font-semibold">Instant</p>
              <p className="text-xs text-muted-foreground">Results</p>
            </div>
          </div>
        </motion.div>

        {/* Tests Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : tests && tests.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test, index) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-xl border overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/ai/learn/aptitude/${test.slug}`)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-2xl">
                      {test.icon || testTypeIcons[test.test_type || 'logical'] || '🧠'}
                    </div>
                    <div className="flex gap-2">
                      {test.is_featured && (
                        <Badge className="bg-primary">Featured</Badge>
                      )}
                      <Badge variant="secondary" className="gap-1">
                        <Coins className="w-3 h-3" />
                        {test.credit_cost || 10}
                      </Badge>
                    </div>
                  </div>

                  <h3 className="font-bold text-lg mb-1">{test.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {test.description}
                  </p>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {test.duration_minutes || 20} min
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart className="w-4 h-4" />
                        {test.total_questions || 25} Q
                      </span>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {test.test_type || 'General'}
                    </Badge>
                  </div>
                </div>

                <div className="bg-muted/50 px-5 py-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Pass: {test.passing_score || 70}%
                  </span>
                  <Button size="sm" className="gap-2">
                    Start Test
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Tests Available</h3>
            <p className="text-muted-foreground">Check back soon for aptitude tests</p>
          </div>
        )}

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-xl p-6 border"
        >
          <h3 className="font-bold text-lg mb-4">Why Take Aptitude Tests?</h3>
          <div className="space-y-3">
            {[
              { icon: Target, text: 'Identify your natural strengths and abilities' },
              { icon: Brain, text: 'Get personalized career recommendations' },
              { icon: Trophy, text: 'Earn certificates to showcase your skills' },
              { icon: BarChart, text: 'Track your progress over time' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AptitudeTests;
