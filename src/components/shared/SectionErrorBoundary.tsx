import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onRetry?: () => void;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.sectionName || 'section'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 text-center bg-muted/50 border-dashed">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-semibold mb-1">
            {this.props.sectionName ? `${this.props.sectionName} Error` : 'Something went wrong'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            This section couldn't be loaded. Please try again.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={this.handleRetry}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier use with hooks
export function withSectionErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  sectionName?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <SectionErrorBoundary sectionName={sectionName}>
        <Component {...props} />
      </SectionErrorBoundary>
    );
  };
}
