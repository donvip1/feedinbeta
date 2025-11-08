import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface CanonicalProps {
  baseUrl?: string;
  path?: string;
}

export const Canonical = ({ 
  baseUrl = window.location.origin, 
  path 
}: CanonicalProps) => {
  const location = useLocation();
  const canonicalPath = path || location.pathname;
  const canonicalUrl = `${baseUrl}${canonicalPath}`;

  return (
    <Helmet>
      <link rel="canonical" href={canonicalUrl} />
    </Helmet>
  );
};
