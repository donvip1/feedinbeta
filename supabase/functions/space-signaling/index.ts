import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// WebRTC signaling server for live spaces
// This handles offer/answer/ICE candidate exchange between peers

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  from: string;
  to?: string;
  spaceId: string;
  data?: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // Check if this is a WebSocket upgrade request
  if (upgradeHeader.toLowerCase() !== "websocket") {
    // Handle regular HTTP requests for testing
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        const { action, spaceId, userId } = body;

        if (action === 'get-peers') {
          // Return list of connected peers for a space
          // In a real implementation, this would query a database or cache
          return new Response(
            JSON.stringify({ 
              success: true, 
              peers: [],
              message: 'Use WebSocket connection for real-time signaling' 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid request' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Expected WebSocket connection',
        info: 'Connect via WebSocket for real-time signaling'
      }), 
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Upgrade to WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);

    // Track connected peers per space
    const connectedPeers = new Map<string, Set<string>>();

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = async (event) => {
      try {
        const message: SignalMessage = JSON.parse(event.data);
        console.log('Received message:', message.type, 'from:', message.from);

        switch (message.type) {
          case 'join':
            // Add peer to space
            if (!connectedPeers.has(message.spaceId)) {
              connectedPeers.set(message.spaceId, new Set());
            }
            connectedPeers.get(message.spaceId)?.add(message.from);
            
            // Notify other peers
            const peers = Array.from(connectedPeers.get(message.spaceId) || []);
            socket.send(JSON.stringify({
              type: 'peers',
              spaceId: message.spaceId,
              peers: peers.filter(p => p !== message.from),
            }));
            break;

          case 'leave':
            // Remove peer from space
            connectedPeers.get(message.spaceId)?.delete(message.from);
            break;

          case 'offer':
          case 'answer':
          case 'ice-candidate':
            // Forward to specific peer
            // In a real implementation, this would use a proper signaling mechanism
            // For now, we rely on Supabase Realtime for peer-to-peer signaling
            socket.send(JSON.stringify({
              type: 'relay',
              originalType: message.type,
              from: message.from,
              to: message.to,
              data: message.data,
            }));
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      // Clean up peer connections
      connectedPeers.forEach((peers, spaceId) => {
        peers.clear();
      });
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  } catch (error) {
    console.error('Error upgrading to WebSocket:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to establish WebSocket connection' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
