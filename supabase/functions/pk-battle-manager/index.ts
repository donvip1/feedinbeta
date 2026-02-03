import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PKBattleRequest {
  action: 'create' | 'challenge' | 'accept' | 'decline' | 'update_score' | 'end' | 'get';
  streamId?: string;
  battleId?: string;
  challengerId?: string;
  durationSeconds?: number;
  scoreChange?: number;
  recipientId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PKBattleRequest = await req.json();
    const { action, streamId, battleId, challengerId, durationSeconds, scoreChange, recipientId } = body;

    let result;

    switch (action) {
      case 'create': {
        // Create a new PK battle for a stream
        if (!streamId) {
          throw new Error("streamId is required");
        }

        // Verify the user owns the stream
        const { data: stream, error: streamError } = await supabase
          .from("live_streams")
          .select("id, user_id")
          .eq("id", streamId)
          .single();

        if (streamError || !stream || stream.user_id !== user.id) {
          throw new Error("Unauthorized: You don't own this stream");
        }

        // Create the battle
        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .insert({
            stream_id: streamId,
            host_id: user.id,
            duration_seconds: durationSeconds || 300,
            status: 'waiting',
          })
          .select()
          .single();

        if (battleError) throw battleError;

        // Update stream room_type
        await supabase
          .from("live_streams")
          .update({ room_type: 'pk_battle' })
          .eq("id", streamId);

        result = { battle };
        break;
      }

      case 'challenge': {
        // Send a challenge to another user
        if (!battleId || !challengerId) {
          throw new Error("battleId and challengerId are required");
        }

        // Verify the battle exists and user is the host
        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .select("*")
          .eq("id", battleId)
          .single();

        if (battleError || !battle) {
          throw new Error("Battle not found");
        }

        if (battle.host_id !== user.id) {
          throw new Error("Only the host can send challenges");
        }

        if (battle.status !== 'waiting') {
          throw new Error("Battle is not in waiting state");
        }

        // Update battle with challenger
        const { data: updatedBattle, error: updateError } = await supabase
          .from("pk_battles")
          .update({ challenger_id: challengerId })
          .eq("id", battleId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Send notification to challenger
        await supabase.from("notifications").insert({
          user_id: challengerId,
          from_user_id: user.id,
          type: 'pk_challenge',
          title: 'PK Battle Challenge!',
          message: 'You have been challenged to a PK Battle!',
          related_id: battleId,
          related_type: 'pk_battle',
        });

        result = { battle: updatedBattle };
        break;
      }

      case 'accept': {
        // Accept a PK battle challenge
        if (!battleId) {
          throw new Error("battleId is required");
        }

        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .select("*")
          .eq("id", battleId)
          .single();

        if (battleError || !battle) {
          throw new Error("Battle not found");
        }

        if (battle.challenger_id !== user.id) {
          throw new Error("You are not the challenger");
        }

        if (battle.status !== 'waiting') {
          throw new Error("Battle is not in waiting state");
        }

        // Start the battle
        const { data: updatedBattle, error: updateError } = await supabase
          .from("pk_battles")
          .update({ 
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .eq("id", battleId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Notify the host
        await supabase.from("notifications").insert({
          user_id: battle.host_id,
          from_user_id: user.id,
          type: 'pk_accepted',
          title: 'Challenge Accepted!',
          message: 'Your PK Battle challenge was accepted. Battle starting!',
          related_id: battleId,
          related_type: 'pk_battle',
        });

        result = { battle: updatedBattle };
        break;
      }

      case 'decline': {
        // Decline a PK battle challenge
        if (!battleId) {
          throw new Error("battleId is required");
        }

        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .select("*")
          .eq("id", battleId)
          .single();

        if (battleError || !battle) {
          throw new Error("Battle not found");
        }

        if (battle.challenger_id !== user.id && battle.host_id !== user.id) {
          throw new Error("You are not part of this battle");
        }

        // Cancel the battle
        const { data: updatedBattle, error: updateError } = await supabase
          .from("pk_battles")
          .update({ 
            status: 'cancelled',
            ended_at: new Date().toISOString(),
          })
          .eq("id", battleId)
          .select()
          .single();

        if (updateError) throw updateError;

        result = { battle: updatedBattle };
        break;
      }

      case 'update_score': {
        // Update score (usually from gift)
        if (!battleId || scoreChange === undefined || !recipientId) {
          throw new Error("battleId, scoreChange, and recipientId are required");
        }

        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .select("*")
          .eq("id", battleId)
          .single();

        if (battleError || !battle) {
          throw new Error("Battle not found");
        }

        if (battle.status !== 'active') {
          throw new Error("Battle is not active");
        }

        // Determine which score to update
        const isHostScore = recipientId === battle.host_id;
        const updateField = isHostScore ? 'host_score' : 'challenger_score';
        const currentScore = isHostScore ? battle.host_score : battle.challenger_score;

        const { data: updatedBattle, error: updateError } = await supabase
          .from("pk_battles")
          .update({ [updateField]: currentScore + scoreChange })
          .eq("id", battleId)
          .select()
          .single();

        if (updateError) throw updateError;

        result = { battle: updatedBattle };
        break;
      }

      case 'end': {
        // End the battle and determine winner
        if (!battleId) {
          throw new Error("battleId is required");
        }

        const { data: battle, error: battleError } = await supabase
          .from("pk_battles")
          .select("*")
          .eq("id", battleId)
          .single();

        if (battleError || !battle) {
          throw new Error("Battle not found");
        }

        if (battle.host_id !== user.id) {
          throw new Error("Only the host can end the battle");
        }

        // Determine winner
        let winnerId = null;
        if (battle.host_score > battle.challenger_score) {
          winnerId = battle.host_id;
        } else if (battle.challenger_score > battle.host_score) {
          winnerId = battle.challenger_id;
        }
        // If tie, no winner

        const { data: updatedBattle, error: updateError } = await supabase
          .from("pk_battles")
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString(),
            winner_id: winnerId,
          })
          .eq("id", battleId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Reset stream room_type
        if (battle.stream_id) {
          await supabase
            .from("live_streams")
            .update({ room_type: 'video_broadcast' })
            .eq("id", battle.stream_id);
        }

        // Notify both participants
        const participants = [battle.host_id, battle.challenger_id].filter(Boolean);
        for (const participantId of participants) {
          const isWinner = participantId === winnerId;
          await supabase.from("notifications").insert({
            user_id: participantId,
            type: 'pk_ended',
            title: winnerId ? (isWinner ? 'You Won! 🏆' : 'Battle Ended') : 'It\'s a Tie!',
            message: winnerId 
              ? (isWinner ? 'Congratulations! You won the PK Battle!' : 'The PK Battle has ended.')
              : 'The PK Battle ended in a tie!',
            related_id: battleId,
            related_type: 'pk_battle',
          });
        }

        result = { battle: updatedBattle, winner_id: winnerId };
        break;
      }

      case 'get': {
        // Get battle details
        if (!battleId && !streamId) {
          throw new Error("battleId or streamId is required");
        }

        let query = supabase.from("pk_battles").select("*");
        
        if (battleId) {
          query = query.eq("id", battleId);
        } else if (streamId) {
          query = query.eq("stream_id", streamId).neq("status", "completed").neq("status", "cancelled");
        }

        const { data: battle, error: battleError } = await query.maybeSingle();

        if (battleError) throw battleError;

        result = { battle };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("PK Battle Manager Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
