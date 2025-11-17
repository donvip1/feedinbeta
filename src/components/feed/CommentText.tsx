import { useNavigate } from 'react-router-dom';

interface CommentTextProps {
  content: string;
  className?: string;
}

export const CommentText = ({ content, className = '' }: CommentTextProps) => {
  const navigate = useNavigate();

  const renderContent = () => {
    // Split content by @mentions
    const parts = content.split(/(@[\w]+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <span
            key={index}
            onClick={async (e) => {
              e.stopPropagation();
              // Find user by username
              const { supabase } = await import('@/integrations/supabase/client');
              const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', username)
                .single();
              
              if (data?.id) {
                navigate(`/profile/${data.id}`);
              }
            }}
            className="text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return <span className={className}>{renderContent()}</span>;
};
