import { motion } from 'framer-motion';
import { BookOpen, Award, Clock, Flame, Trophy, Target } from 'lucide-react';

interface LearningStatsProps {
  stats: {
    coursesInProgress?: number;
    coursesCompleted?: number;
    certificatesEarned?: number;
    totalHoursLearned?: number;
    currentStreak?: number;
    longestStreak?: number;
  };
  variant?: 'default' | 'compact' | 'detailed';
}

export const LearningStats = ({ stats, variant = 'default' }: LearningStatsProps) => {
  const statItems = [
    { 
      label: 'In Progress', 
      value: stats.coursesInProgress || 0, 
      icon: BookOpen, 
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    { 
      label: 'Completed', 
      value: stats.coursesCompleted || 0, 
      icon: Trophy, 
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    { 
      label: 'Certificates', 
      value: stats.certificatesEarned || 0, 
      icon: Award, 
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10'
    },
    { 
      label: 'Hours Learned', 
      value: stats.totalHoursLearned?.toFixed(1) || '0', 
      icon: Clock, 
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    { 
      label: 'Day Streak', 
      value: stats.currentStreak || 0, 
      icon: Flame, 
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    { 
      label: 'Best Streak', 
      value: stats.longestStreak || 0, 
      icon: Target, 
      iconColor: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
  ];

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {statItems.slice(0, 4).map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border/50 flex-shrink-0"
          >
            <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            <span className="font-semibold text-foreground">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statItems.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-xl ${stat.bgColor} border border-border/30`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-background/50 flex items-center justify-center">
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {statItems.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="text-center p-3 bg-card/50 rounded-lg border border-border/30"
        >
          <div className={`w-10 h-10 mx-auto rounded-lg ${stat.bgColor} flex items-center justify-center mb-2`}>
            <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
          </div>
          <div className="text-xl font-bold text-foreground">{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
};
