
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with the admin key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { user1_username, user2_username } = await req.json();

    // 1. Get User IDs from usernames
    const { data: user1, error: user1Error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', user1_username)
      .single();

    const { data: user2, error: user2Error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', user2_username)
      .single();

    if (user1Error || user2Error || !user1 || !user2) {
      throw new Error('Could not find one or both users.');
    }

    const user1_id = user1.id;
    const user2_id = user2.id;

    // 2. Find the conversation ID they share
    const { data: conversation, error: convError } = await supabaseAdmin
      .rpc('get_conversation_id', { user1_id, user2_id })
      .single();

    if (convError || !conversation) {
      throw new Error('Could not find a conversation between the two users.');
    }

    const conv_id = conversation.conversation_id;

    // 3. Delete the messages from that conversation
    const { error: deleteError } = await supabaseAdmin
      .from('messages')
      .delete()
      .eq('conversation_id', conv_id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response('Chat history deleted successfully.', { status: 200 });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
