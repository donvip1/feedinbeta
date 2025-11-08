create or replace function clear_my_chat_history(conv_id uuid, requestor_id uuid)
returns void as $$
begin
  -- Mark messages sent by the user as deleted for them
  update public.messages
  set deleted_for_sender = true,
      deleted_at = now()
  where conversation_id = conv_id
    and sender_id = requestor_id;

  -- Mark messages received by the user as deleted for them
  update public.messages
  set deleted_for_receiver = true,
      deleted_at = now()
  where conversation_id = conv_id
    and sender_id != requestor_id;
end;
$$ language plpgsql;