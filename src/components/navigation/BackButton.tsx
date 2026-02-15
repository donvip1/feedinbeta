import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigation } from '@/context/NavigationContext';

interface BackButtonProps {
  fallback?: string;
  className?: string;
  variant?: 'ghost' | 'outline' | 'default' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
}

/**
 * Universal back button that uses the navigation history stack.
 * Replaces all `onClick={() => navigate(-1)}` patterns.
 */
export const BackButton: React.FC<BackButtonProps> = ({
  fallback,
  className,
  variant = 'ghost',
  size = 'icon',
  children,
}) => {
  const { goBack } = useNavigation();

  return (
    <Button variant={variant} size={size} onClick={() => goBack(fallback)} className={className}>
      <ArrowLeft className="w-5 h-5" />
      {children}
    </Button>
  );
};
