import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamId = url.searchParams.get("id");

    if (!streamId) {
      return new Response(JSON.stringify({ error: "Missing stream id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: stream, error } = await supabase
      .from("live_streams")
      .select("id, title, description, cover_image_url, user_id, status, viewer_count")
      .eq("id", streamId)
      .maybeSingle();

    if (error || !stream) {
      return new Response(
        JSON.stringify({ error: "Stream not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get host profile
    let hostName = "FEEDIN User";
    if (stream.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", stream.user_id)
        .maybeSingle();
      if (profile) {
        hostName = profile.display_name || profile.username || "FEEDIN User";
      }
    }

    const title = stream.title || "Live Stream on FEEDIN";
    const description = stream.description || `Hosted by ${hostName} • ${stream.viewer_count || 0} watching`;
    const image = stream.cover_image_url || "https://feedinn.com/favicon.png";
    const streamUrl = `https://feedinn.com/live/stream/${stream.id}`;

    return new Response(
      JSON.stringify({
        title,
        description,
        image,
        url: streamUrl,
        host: hostName,
        status: stream.status,
        viewers: stream.viewer_count,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("OG Stream error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
