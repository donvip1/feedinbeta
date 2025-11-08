import { Helmet } from 'react-helmet-async';

interface OrganizationSchemaProps {
  name: string;
  url: string;
  logo: string;
  description: string;
  socialLinks?: string[];
}

export const OrganizationSchema = ({
  name,
  url,
  logo,
  description,
  socialLinks = [],
}: OrganizationSchemaProps) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    logo,
    description,
    sameAs: socialLinks,
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};

interface WebsiteSchemaProps {
  name: string;
  url: string;
  description: string;
  searchUrl?: string;
}

export const WebsiteSchema = ({
  name,
  url,
  description,
  searchUrl,
}: WebsiteSchemaProps) => {
  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
  };

  if (searchUrl) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: `${searchUrl}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    };
  }

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
};
