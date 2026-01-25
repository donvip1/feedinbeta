import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pending scheduled messages that are due
    const now = new Date().toISOString();
    const { data: scheduledMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching scheduled messages:", fetchError);
      throw fetchError;
    }

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No scheduled messages to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${scheduledMessages.length} scheduled messages`);

    let processed = 0;
    let failed = 0;

    for (const scheduled of scheduledMessages) {
      try {
        // Determine target table based on conversation_id or group_id
        if (scheduled.conversation_id) {
          // Send to DM
          const { error: insertError } = await supabase
            .from("messages")
            .insert({
              conversation_id: scheduled.conversation_id,
              sender_id: scheduled.user_id,
              content: scheduled.content,
              media_url: scheduled.media_url,
              media_type: scheduled.media_type,
            });

          if (insertError) throw insertError;
        } else if (scheduled.group_id) {
          // Send to Group
          const { error: insertError } = await supabase
            .from("group_messages")
            .insert({
              group_id: scheduled.group_id,
              sender_id: scheduled.user_id,
              content: scheduled.content,
              media_url: scheduled.media_url,
              media_type: scheduled.media_type,
            });

          if (insertError) throw insertError;
        }

        // Mark as sent
        await supabase
          .from("scheduled_messages")
          .update({ 
            status: "sent", 
            sent_at: new Date().toISOString() 
          })
          .eq("id", scheduled.id);

        processed++;
      } catch (error: any) {
        console.error(`Error processing scheduled message ${scheduled.id}:`, error);
        
        // Mark as failed
        await supabase
          .from("scheduled_messages")
          .update({ 
            status: "failed", 
            error_message: error.message || "Unknown error"
          })
          .eq("id", scheduled.id);

        failed++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "Scheduled messages processed", 
        processed, 
        failed,
        total: scheduledMessages.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-scheduled-messages:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
