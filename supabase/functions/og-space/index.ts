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
    const spaceId = url.searchParams.get("id");

    if (!spaceId) {
      return new Response(JSON.stringify({ error: "Missing space id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try by UUID first, then by share_link
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(spaceId);

    let query = supabase
      .from("live_spaces")
      .select("id, title, description, cover_image_url, user_id, status, listener_count");

    if (isUUID) {
      query = query.eq("id", spaceId);
    } else {
      query = query.eq("share_link", spaceId);
    }

    const { data: space, error } = await query.maybeSingle();

    if (error || !space) {
      return new Response(
        JSON.stringify({ error: "Space not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get host profile
    let hostName = "FEEDIN User";
    if (space.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", space.user_id)
        .maybeSingle();
      if (profile) {
        hostName = profile.display_name || profile.username || "FEEDIN User";
      }
    }

    const title = space.title || "Live Space on FEEDIN";
    const description = space.description || `Hosted by ${hostName} • ${space.listener_count || 0} listening`;
    const defaultImage = "https://feedinn.com/favicon.png";
    const image = space.cover_image_url || defaultImage;
    const spaceUrl = `https://feedinn.com/live/space/${space.id}`;

    return new Response(
      JSON.stringify({
        title,
        description,
        image,
        url: spaceUrl,
        host: hostName,
        status: space.status,
        listeners: space.listener_count,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("OG Space error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
