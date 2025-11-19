import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting attachment cleanup process...');

    // Get expired attachments (24 hours after download)
    const { data: expiredAttachments, error: fetchError } = await supabaseClient
      .rpc('get_expired_attachments');

    if (fetchError) {
      console.error('Error fetching expired attachments:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredAttachments?.length || 0} expired attachments`);

    if (!expiredAttachments || expiredAttachments.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired attachments found', deleted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deletedCount = 0;
    const errors: any[] = [];

    // Delete files from storage
    for (const attachment of expiredAttachments) {
      try {
        // Delete from storage
        const { error: storageError } = await supabaseClient.storage
          .from('chat-media')
          .remove([attachment.file_path]);

        if (storageError) {
          console.error(`Error deleting file ${attachment.file_path}:`, storageError);
          errors.push({ file_path: attachment.file_path, error: storageError.message });
          continue;
        }

        // Mark as deleted in database
        const { error: updateError } = await supabaseClient
          .from('message_attachments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', attachment.id);

        if (updateError) {
          console.error(`Error updating attachment ${attachment.id}:`, updateError);
          errors.push({ id: attachment.id, error: updateError.message });
          continue;
        }

        deletedCount++;
        console.log(`Successfully deleted attachment: ${attachment.file_path}`);
      } catch (error: any) {
        console.error(`Unexpected error processing attachment:`, error);
        errors.push({ attachment_id: attachment.id, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Cleanup completed',
        deleted: deletedCount,
        total: expiredAttachments.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cleanup function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
