-- Fix the post_shares check constraint to include 'refeed' and 'quote' share types
ALTER TABLE post_shares DROP CONSTRAINT IF EXISTS post_shares_share_type_check;

ALTER TABLE post_shares ADD CONSTRAINT post_shares_share_type_check 
CHECK (share_type = ANY (ARRAY['direct'::text, 'story'::text, 'external'::text, 'refeed'::text, 'quote'::text]));