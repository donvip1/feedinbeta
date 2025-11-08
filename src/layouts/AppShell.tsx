import { ReactNode } from 'react';
import { RouteGuard } from '@/routes/RouteGuard';
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary';
import { WebsiteSchema, OrganizationSchema } from '@/components/meta/StructuredData';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  return (
    <AppErrorBoundary>
      <WebsiteSchema
        name="FEEDIN"
        url={window.location.origin}
        description="AI-Powered Social Media Intelligence Platform"
        searchUrl={`${window.location.origin}/search`}
      />
      <OrganizationSchema
        name="FEEDIN"
        url={window.location.origin}
        logo={`${window.location.origin}/feedin-logo.png`}
        description="Connect, create, and engage with AI-powered social media features"
      />
      <RouteGuard>
        {children}
      </RouteGuard>
    </AppErrorBoundary>
  );
};
