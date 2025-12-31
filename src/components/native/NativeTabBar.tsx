import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';

interface TabItem {
  path: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
}

interface NativeTabBarProps {
  tabs?: TabItem[];
  onCreatePress?: () => void;
  className?: string;
}

const defaultTabs: TabItem[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/create', icon: PlusCircle, label: 'Create' },
  { path: '/messages', icon: MessageCircle, label: 'Messages' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export const NativeTabBar: React.FC<NativeTabBarProps> = ({
  tabs = defaultTabs,
  onCreatePress,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { haptic, isNative, platform } = useNativeFeatures();
  const [activeIndex, setActiveIndex] = useState(0);

  // Calculate safe area for native platforms
  const safeAreaBottom = isNative && platform === 'ios' ? 'pb-8' : 'pb-0';

  // Update active index on route change
  useEffect(() => {
    const index = tabs.findIndex(tab => {
      if (tab.path === '/') {
        return location.pathname === '/';
      }
      return location.pathname.startsWith(tab.path);
    });
    if (index !== -1) {
      setActiveIndex(index);
    }
  }, [location.pathname, tabs]);

  const handleTabPress = useCallback((tab: TabItem, index: number) => {
    haptic('selection');
    
    if (tab.path === '/create' && onCreatePress) {
      onCreatePress();
      return;
    }

    if (location.pathname === tab.path) {
      // Already on this tab - scroll to top or refresh
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveIndex(index);
      navigate(tab.path);
    }
  }, [haptic, location.pathname, navigate, onCreatePress]);

  return (
    <motion.nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border ${safeAreaBottom} ${className}`}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab, index) => {
          const isActive = activeIndex === index;
          const isCreate = tab.path === '/create';
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.path}
              onClick={() => handleTabPress(tab, index)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full ${
                isCreate ? 'px-2' : ''
              }`}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              {/* Create button special styling */}
              {isCreate ? (
                <motion.div
                  className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </motion.div>
              ) : (
                <>
                  {/* Icon with badge */}
                  <div className="relative">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                    </motion.div>

                    {/* Badge */}
                    <AnimatePresence>
                      {tab.badge && tab.badge > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive flex items-center justify-center"
                        >
                          <span className="text-[10px] font-bold text-destructive-foreground px-1">
                            {tab.badge > 99 ? '99+' : tab.badge}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Label */}
                  <motion.span
                    className={`text-[10px] mt-1 ${
                      isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                    animate={{
                      opacity: isActive ? 1 : 0.7,
                    }}
                  >
                    {tab.label}
                  </motion.span>

                  {/* Active indicator dot */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      />
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
};

// Floating action button for create
interface FloatingCreateButtonProps {
  onPress: () => void;
  visible?: boolean;
}

export const FloatingCreateButton: React.FC<FloatingCreateButtonProps> = ({
  onPress,
  visible = true,
}) => {
  const { haptic, isNative, platform } = useNativeFeatures();
  const bottomOffset = isNative && platform === 'ios' ? 'bottom-24' : 'bottom-20';

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={() => {
            haptic('medium');
            onPress();
          }}
          className={`fixed right-4 ${bottomOffset} z-40 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center`}
          style={{
            boxShadow: '0 4px 20px -2px hsl(var(--primary) / 0.5)',
          }}
        >
          <PlusCircle className="w-7 h-7 text-primary-foreground" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default NativeTabBar;
