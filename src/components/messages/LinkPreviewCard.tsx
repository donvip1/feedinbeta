import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LinkMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
  url: string;
}

interface LinkPreviewCardProps {
  url: string;
  isOwn: boolean;
}

// Simple in-memory + localStorage cache
const metadataCache = new Map<string, LinkMetadata | null>();

const getCachedMetadata = (url: string): LinkMetadata | null | undefined => {
  if (metadataCache.has(url)) return metadataCache.get(url)!;
  try {
    const stored = localStorage.getItem(`link-preview:${url}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      metadataCache.set(url, parsed);
      return parsed;
    }
  } catch {}
  return undefined; // not cached
};

const setCachedMetadata = (url: string, data: LinkMetadata | null) => {
  metadataCache.set(url, data);
  try {
    if (data) {
      localStorage.setItem(`link-preview:${url}`, JSON.stringify(data));
    }
  } catch {}
};

export const LinkPreviewCard = ({ url, isOwn }: LinkPreviewCardProps) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const cached = getCachedMetadata(url);
    if (cached !== undefined) {
      setMetadata(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMetadata = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('extract-link-metadata', {
          body: { url },
        });

        if (cancelled) return;
        if (error || !data?.title) {
          setCachedMetadata(url, null);
          setError(true);
        } else {
          setCachedMetadata(url, data);
          setMetadata(data);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetadata();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <div className={cn(
        "mt-1.5 rounded-xl overflow-hidden border animate-pulse",
        isOwn ? "border-primary-foreground/20" : "border-border"
      )}>
        <div className={cn("h-8 px-3 flex items-center gap-2", isOwn ? "bg-white/10" : "bg-muted/50")}>
          <div className="w-3 h-3 rounded-full bg-current opacity-20" />
          <div className="h-3 w-24 rounded bg-current opacity-10" />
        </div>
      </div>
    );
  }

  if (error || !metadata) return null;

  return (
    <a
      href={metadata.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "block mt-1.5 rounded-xl overflow-hidden border transition-opacity hover:opacity-90",
        isOwn ? "border-primary-foreground/20" : "border-border"
      )}
    >
      {metadata.image && (
        <div className="w-full h-32 overflow-hidden">
          <img
            src={metadata.image}
            alt={metadata.title || ''}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className={cn(
        "px-3 py-2",
        isOwn ? "bg-white/10" : "bg-muted/50"
      )}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
          <span className="text-[10px] opacity-50 truncate uppercase tracking-wide">
            {metadata.domain}
          </span>
        </div>
        {metadata.title && (
          <p className={cn(
            "text-xs font-semibold line-clamp-2 leading-snug",
            isOwn ? "text-primary-foreground" : "text-foreground"
          )}>
            {metadata.title}
          </p>
        )}
        {metadata.description && (
          <p className={cn(
            "text-[11px] line-clamp-2 mt-0.5 leading-snug",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {metadata.description}
          </p>
        )}
      </div>
    </a>
  );
};
