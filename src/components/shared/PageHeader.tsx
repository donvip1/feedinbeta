import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  icon?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export const PageHeader = ({
  title,
  icon,
  showBack = true,
  onBack,
  rightContent,
  className = '',
  sticky = true
}: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`${sticky ? 'sticky top-0' : ''} z-50 bg-background/95 backdrop-blur-lg border-b border-border ${className}`}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-9 w-9 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            {icon && <span className="text-primary">{icon}</span>}
            <h1 className="text-lg font-bold truncate">{title}</h1>
          </div>
          {rightContent && (
            <div className="flex items-center gap-2">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
};

export default PageHeader;
