import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSecureSession } from '@/hooks/useSecureSession';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Smartphone, Monitor, Tablet, LogOut, 
  Shield, Clock, MapPin, AlertTriangle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserSession {
  id: string;
  device_fingerprint: string;
  device_info: {
    name?: string;
    userAgent?: string;
    platform?: string;
    screenResolution?: string;
  };
  ip_address: string | null;
  user_agent: string | null;
  last_active_at: string;
  created_at: string;
  is_active: boolean;
  is_trusted: boolean;
}

const SessionManagement = () => {
  const navigate = useNavigate();
  const { user, signOutAllDevices, loading: authLoading } = useAuth();
  const { getActiveSessions, invalidateSession, logoutAllDevices } = useSecureSession();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFingerprint, setCurrentFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    loadSessions();
    // Get current device fingerprint
    const fp = localStorage.getItem('device_fp');
    setCurrentFingerprint(fp);
  }, [user]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getActiveSessions();
      setSessions(data as UserSession[]);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidateSession = async (sessionId: string) => {
    const success = await invalidateSession(sessionId);
    if (success) {
      toast.success('Session terminated');
      loadSessions();
    } else {
      toast.error('Failed to terminate session');
    }
  };

  const handleLogoutAllDevices = async () => {
    try {
      await signOutAllDevices();
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to logout from all devices');
    }
  };

  const getDeviceIcon = (deviceInfo: UserSession['device_info']) => {
    const name = deviceInfo?.name?.toLowerCase() || '';
    if (name.includes('iphone') || name.includes('android phone')) {
      return <Smartphone className="w-5 h-5" />;
    }
    if (name.includes('ipad') || name.includes('tablet')) {
      return <Tablet className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Session Management</h1>
            <p className="text-sm text-muted-foreground">Manage your active sessions</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Security Notice */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium">Security Notice</h3>
                <p className="text-sm text-muted-foreground">
                  Review your active sessions regularly. If you see any unfamiliar devices, 
                  terminate those sessions immediately and change your password.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logout All Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Sign Out Everywhere
            </CardTitle>
            <CardDescription>
              This will sign you out from all devices including this one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out All Devices
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will terminate all your active sessions on all devices. 
                    You will need to sign in again on each device.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogoutAllDevices}>
                    Sign Out All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Active Sessions ({sessions.length})</span>
              <Button variant="ghost" size="sm" onClick={loadSessions}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Devices currently signed in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No active sessions found
              </p>
            ) : (
              sessions.map((session) => {
                const isCurrentDevice = session.device_fingerprint === currentFingerprint;
                
                return (
                  <div 
                    key={session.id} 
                    className={`p-4 rounded-lg border ${isCurrentDevice ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-muted">
                          {getDeviceIcon(session.device_info)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.device_info?.name || 'Unknown Device'}
                            </span>
                            {isCurrentDevice && (
                              <Badge variant="default" className="text-xs">
                                This device
                              </Badge>
                            )}
                            {session.is_trusted && (
                              <Badge variant="secondary" className="text-xs">
                                Trusted
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            Last active {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            First signed in {format(new Date(session.created_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>
                      
                      {!isCurrentDevice && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <LogOut className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Terminate this session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will sign out {session.device_info?.name || 'this device'}. 
                                The user of that device will need to sign in again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleInvalidateSession(session.id)}>
                                Terminate Session
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SessionManagement;
