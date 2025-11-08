
create or replace function get_conversation_id(user1_id uuid, user2_id uuid)
returns table (conversation_id uuid)
as $$
begin
  return query
  select cp.conversation_id
  from conversation_participants cp
  where cp.user_id in (user1_id, user2_id)
  group by cp.conversation_id
  having count(distinct cp.user_id) = 2;
end; 
$$ language plpgsql;