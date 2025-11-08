import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeChannelOptions {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<any>) => void;
}

export const useRealtimeChannel = ({
  channelName,
  table,
  schema = 'public',
  filter,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseRealtimeChannelOptions) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase.channel(channelName);

    const handleChange = (payload: RealtimePostgresChangesPayload<any>) => {
      if (onChange) {
        onChange(payload);
      }
      
      switch (payload.eventType) {
        case 'INSERT':
          onInsert?.(payload);
          break;
        case 'UPDATE':
          onUpdate?.(payload);
          break;
        case 'DELETE':
          onDelete?.(payload);
          break;
      }
    };

    channel
      .on(
        'postgres_changes' as any,
        {
          event,
          schema,
          table,
          filter,
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Channel error for ${channelName}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [channelName, table, schema, filter, event]);

  return channelRef;
};
