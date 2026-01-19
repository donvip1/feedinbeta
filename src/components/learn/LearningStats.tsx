import { motion } from 'framer-motion';

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

// Image-based visual representations for each stat
const statImages: Record<string, string> = {
  'in-progress': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=100&h=100&fit=crop',
  'completed': 'https://images.unsplash.com/photo-1557318041-1ce374d55ebf?w=100&h=100&fit=crop',
  'certificates': 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?w=100&h=100&fit=crop',
  'hours': 'https://images.unsplash.com/photo-1501139083538-0139583c060f?w=100&h=100&fit=crop',
  'streak': 'https://images.unsplash.com/photo-1517960413843-0aee8e2b3285?w=100&h=100&fit=crop',
  'best-streak': 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?w=100&h=100&fit=crop',
};

export const LearningStats = ({ stats, variant = 'default' }: LearningStatsProps) => {
  const statItems = [
    { 
      label: 'In Progress', 
      value: stats?.coursesInProgress || 0, 
      imageKey: 'in-progress',
      gradient: 'from-blue-500/20 to-blue-600/20',
      borderColor: 'border-blue-500/30'
    },
    { 
      label: 'Completed', 
      value: stats?.coursesCompleted || 0, 
      imageKey: 'completed',
      gradient: 'from-green-500/20 to-green-600/20',
      borderColor: 'border-green-500/30'
    },
    { 
      label: 'Certificates', 
      value: stats?.certificatesEarned || 0, 
      imageKey: 'certificates',
      gradient: 'from-yellow-500/20 to-yellow-600/20',
      borderColor: 'border-yellow-500/30'
    },
    { 
      label: 'Hours Learned', 
      value: stats?.totalHoursLearned?.toFixed(1) || '0', 
      imageKey: 'hours',
      gradient: 'from-purple-500/20 to-purple-600/20',
      borderColor: 'border-purple-500/30'
    },
    { 
      label: 'Day Streak', 
      value: stats?.currentStreak || 0, 
      imageKey: 'streak',
      gradient: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-500/30'
    },
    { 
      label: 'Best Streak', 
      value: stats?.longestStreak || 0, 
      imageKey: 'best-streak',
      gradient: 'from-red-500/20 to-red-600/20',
      borderColor: 'border-red-500/30'
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
            className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-br ${stat.gradient} rounded-xl border ${stat.borderColor} flex-shrink-0`}
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden">
              <img 
                src={statImages[stat.imageKey]} 
                alt={stat.label} 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-bold text-foreground text-lg">{stat.value}</span>
              <span className="text-xs text-muted-foreground block">{stat.label}</span>
            </div>
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
            className={`relative overflow-hidden p-4 rounded-xl bg-gradient-to-br ${stat.gradient} border ${stat.borderColor}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg">
                <img 
                  src={statImages[stat.imageKey]} 
                  alt={stat.label} 
                  className="w-full h-full object-cover"
                />
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
          className={`relative overflow-hidden text-center p-3 bg-gradient-to-br ${stat.gradient} rounded-xl border ${stat.borderColor}`}
        >
          <div className="w-12 h-12 mx-auto rounded-xl overflow-hidden shadow-md mb-2">
            <img 
              src={statImages[stat.imageKey]} 
              alt={stat.label} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-xl font-bold text-foreground">{stat.value}</div>
          <div className="text-xs text-muted-foreground">{stat.label}</div>
        </motion.div>
      ))}
    </div>
  );
};
