import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, Gift } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const Referral = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referrer, setReferrer] = useState<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const lookupReferrer = async () => {
      if (!username) {
        setError('Invalid referral link');
        setLoading(false);
        return;
      }

      try {
        // Look up the referrer by username
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching referrer:', fetchError);
          setError('Could not find this referrer');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('This referral link is invalid');
          setLoading(false);
          return;
        }

        setReferrer(data);
        
        // Store referrer ID in sessionStorage for signup
        sessionStorage.setItem('referrerId', data.id);
        sessionStorage.setItem('referrerUsername', data.username);
        if (data.display_name) {
          sessionStorage.setItem('referrerDisplayName', data.display_name);
        }
        
        // Redirect to auth after a brief delay
        setTimeout(() => {
          navigate('/auth');
        }, 2500);
      } catch (err) {
        console.error('Referral lookup error:', err);
        setError('Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    lookupReferrer();
  }, [username, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading referral...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <img src={feedinLogo} alt="FEEDIN" className="w-24 h-24 mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Referral</h1>
        <p className="text-muted-foreground text-center mb-6">{error}</p>
        <button
          onClick={() => navigate('/auth')}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Sign Up Anyway
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="text-center max-w-md animate-fade-in">
        {/* Logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
          <img src={feedinLogo} alt="FEEDIN" className="w-32 h-32 mx-auto relative z-10" />
        </div>

        {/* Referral Banner */}
        <div className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gift className="w-6 h-6 text-primary animate-bounce" />
            <span className="text-lg font-semibold text-foreground">You've Been Invited!</span>
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            {referrer?.avatar_url ? (
              <img 
                src={referrer.avatar_url} 
                alt={referrer.display_name || referrer.username}
                className="w-16 h-16 rounded-full border-2 border-primary"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          
          <p className="text-foreground font-medium mb-1">
            {referrer?.display_name || `@${referrer?.username}`}
          </p>
          <p className="text-sm text-muted-foreground">
            invited you to join FEEDIN
          </p>
        </div>

        {/* Redirect message */}
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Redirecting to sign up...</span>
        </div>
      </div>
    </div>
  );
};

export default Referral;
