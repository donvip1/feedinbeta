import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch helper for calling the ai-agent edge function with proper authentication.
 * Automatically includes the user's session token in the Authorization header.
 */
export async function fetchAIAgent(body: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('You must be signed in to use AI features.');
  }

  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
}
