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
    const format = url.searchParams.get("format") || "html";

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

    const title = `🎙️ ${space.title || 'Live Space'} — FeedIn Live`;
    const description = space.description 
      || `Join "${space.title || 'Live Space'}" hosted by ${hostName} • ${space.listener_count || 0} listening now on FeedIn`;
    const defaultImage = "https://feedinn.com/icon-512.png";
    const image = space.cover_image_url || defaultImage;
    const spaceUrl = `https://feedinn.com/live/space/${space.id}`;

    // Return HTML with OG meta tags for social crawlers
    if (format === "html" || req.headers.get("accept")?.includes("text/html")) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(spaceUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="FEEDIN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaceUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(spaceUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // JSON fallback
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
