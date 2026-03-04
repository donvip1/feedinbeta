import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch URL' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();

    // Extract OG tags and meta tags
    const getMetaContent = (html: string, property: string): string | null => {
      // Try og: tags
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try twitter: tags
      const twMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, 'i'));
      if (twMatch) return twMatch[1];

      // Try regular meta description
      if (property === 'description') {
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
        if (descMatch) return descMatch[1];
      }

      return null;
    };

    const title = getMetaContent(html, 'title') 
      || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() 
      || null;
    const description = getMetaContent(html, 'description');
    let image = getMetaContent(html, 'image');

    // Resolve relative image URLs
    if (image && !image.startsWith('http')) {
      image = new URL(image, url).href;
    }

    const metadata = {
      title: title?.substring(0, 200) || null,
      description: description?.substring(0, 300) || null,
      image,
      domain: parsedUrl.hostname,
      url,
    };

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return new Response(JSON.stringify({ error: 'Failed to extract metadata' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
