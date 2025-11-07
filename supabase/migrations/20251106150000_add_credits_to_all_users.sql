-- Add 200 credits to every user
UPDATE profiles
SET credits = credits + 200;

-- Create a notification for each user
INSERT INTO notifications (user_id, type, message, from_user_id)
SELECT id, 'info', 'You have received 200 credits from the FEEDIN team for your good job!', (SELECT id FROM profiles WHERE username = 'feedin')
FROM auth.users;