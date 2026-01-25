import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GroupChatInterface } from '@/components/groups/GroupChatInterface';
import { useAuth } from '@/hooks/useAuth';

const GroupChat = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!groupId) {
    navigate('/messages');
    return null;
  }

  const handleBack = () => {
    // Use browser history if available, otherwise go to groups list
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/groups', { replace: true });
    }
  };

  return (
    <div className="h-screen bg-background">
      <GroupChatInterface
        groupId={groupId}
        onBack={handleBack}
      />
    </div>
  );
};

export default GroupChat;
