import React from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Award, CheckCircle, XCircle, Calendar, User, BookOpen, ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import feedinLogo from '@/assets/feedin-logo.png';

const CertificateVerify = () => {
  const { certificateNumber } = useParams();
  const navigate = useNavigate();

  const { data: certificate, isLoading, error } = useQuery({
    queryKey: ['certificate-verify', certificateNumber],
    queryFn: async () => {
      if (!certificateNumber) throw new Error('Certificate number required');

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          course:courses(
            title,
            thumbnail_url,
            duration_hours,
            instructor:instructors(
              profiles:profiles(display_name, avatar_url)
            )
          ),
          user:profiles!certificates_user_id_fkey(
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('certificate_number', certificateNumber)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!certificateNumber,
  });

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate Verification - ${certificate?.course?.title}`,
          text: `Verify this FeedIn certificate`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Verification link copied!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center">
            <XCircle className="w-12 h-12 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The certificate number "{certificateNumber}" could not be verified. 
            Please check the number and try again.
          </p>
          <Button onClick={() => navigate('/ai/learn')}>
            Browse Courses
          </Button>
        </motion.div>
      </div>
    );
  }

  const recipientName = certificate.user?.display_name || certificate.user?.username || 'Student';
  const instructorName = certificate.course?.instructor?.profiles?.display_name || 'Instructor';
  const metadata = certificate.metadata as Record<string, any> || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={feedinLogo} alt="FeedIn" className="h-8" />
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {/* Verification Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className={`rounded-xl p-6 border ${
            certificate.is_verified 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-yellow-500/10 border-yellow-500/30'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                certificate.is_verified ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}>
                {certificate.is_verified ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <Award className="w-8 h-8 text-yellow-500" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {certificate.is_verified ? 'Verified Certificate' : 'Certificate Found'}
                </h2>
                <p className="text-muted-foreground">
                  {certificate.is_verified 
                    ? 'This certificate is authentic and issued by FeedIn Learn'
                    : 'This certificate exists but verification is pending'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Certificate Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border overflow-hidden"
        >
          {/* Certificate Header */}
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 p-8 text-center border-b">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Award className="w-10 h-10 text-primary" />
            </div>
            <Badge className={certificate.certificate_type === 'diploma' ? 'bg-purple-500' : 'bg-primary'}>
              {certificate.certificate_type === 'diploma' ? 'Diploma' : 'Certificate'} of Completion
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold mt-4">{certificate.course?.title}</h1>
          </div>

          {/* Certificate Body */}
          <div className="p-8 space-y-6">
            {/* Recipient */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Awarded to</p>
              <div className="flex items-center justify-center gap-3">
                {certificate.user?.avatar_url ? (
                  <img 
                    src={certificate.user.avatar_url} 
                    alt={recipientName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                )}
                <h3 className="text-xl font-semibold">{recipientName}</h3>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Calendar className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-semibold">
                  {format(new Date(certificate.issue_date), 'MMMM d, yyyy')}
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <User className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Instructor</p>
                <p className="font-semibold">{instructorName}</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <BookOpen className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">
                  {certificate.course?.duration_hours || 0} hours
                </p>
              </div>
            </div>

            {/* Certificate Number */}
            <div className="text-center pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Certificate ID</p>
              <p className="font-mono text-lg font-semibold text-primary">
                {certificate.certificate_number}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 mt-6"
        >
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={() => navigate(`/ai/learn/course/${certificate.course?.title?.toLowerCase().replace(/\s+/g, '-')}`)}
          >
            <ExternalLink className="w-4 h-4" />
            View Course
          </Button>
          <Button className="flex-1 gap-2" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            Share Verification
          </Button>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Issued by FeedIn Learn Platform</p>
          <p className="mt-1">Verification URL: {window.location.href}</p>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerify;
