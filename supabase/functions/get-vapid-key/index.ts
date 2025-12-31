import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    
    if (!vapidPublicKey) {
      console.log('[get-vapid-key] VAPID_PUBLIC_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'VAPID key not configured',
          // Fallback key for development
          publicKey: 'BEbH8f_x9v5NxFSdoZ6i0Q0f7qP3rVzB3qFKpN9mLkXHEcHGlJqKvJMOxGlXHUxPmV6BkCpK_6FfH8mN5rXwK7Y',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-vapid-key] Returning VAPID public key');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        publicKey: vapidPublicKey,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[get-vapid-key] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
