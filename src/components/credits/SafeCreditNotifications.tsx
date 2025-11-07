import React, { Component, ReactNode } from 'react';
import CreditNotifications from './CreditNotifications';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class CreditNotificationsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('CreditNotifications error (suppressed):', error.message);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default function SafeCreditNotifications() {
  // Safety check for React
  if (typeof React === 'undefined' || !React) {
    return null;
  }

  return (
    <CreditNotificationsErrorBoundary>
      <CreditNotifications />
    </CreditNotificationsErrorBoundary>
  );
}
