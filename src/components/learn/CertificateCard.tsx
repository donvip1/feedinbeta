import { motion } from 'framer-motion';
import { Award, Download, Share2, ExternalLink, Calendar, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CertificateCardProps {
  certificate: {
    id: string;
    certificate_number: string;
    certificate_type?: string;
    issue_date: string;
    certificate_url?: string;
    is_verified?: boolean;
    course?: {
      title: string;
      thumbnail_url?: string;
      instructor?: {
        profiles?: {
          display_name?: string;
        };
      };
    };
    metadata?: {
      course_title?: string;
      instructor_name?: string;
      completion_date?: string;
    };
  };
  onDownload?: () => void;
  onShare?: () => void;
}

export const CertificateCard = ({ certificate, onDownload, onShare }: CertificateCardProps) => {
  const courseTitle = certificate.course?.title || certificate.metadata?.course_title || 'Course';
  const instructorName = certificate.course?.instructor?.profiles?.display_name || 
    certificate.metadata?.instructor_name || 'Instructor';

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    
    const shareUrl = `${window.location.origin}/verify/${certificate.certificate_number}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificate: ${courseTitle}`,
          text: `I earned a certificate in ${courseTitle}!`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Certificate link copied to clipboard!');
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-gradient-to-br from-primary/10 via-card to-accent/10 rounded-xl border border-primary/20 overflow-hidden group"
    >
      {/* Certificate Preview */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        {certificate.certificate_url ? (
          <img 
            src={certificate.certificate_url} 
            alt="Certificate" 
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="text-center p-6">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Award className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-1">Certificate of Completion</h3>
            <p className="text-sm text-muted-foreground">{courseTitle}</p>
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" className="gap-2" onClick={onDownload}>
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button size="sm" variant="secondary" className="gap-2" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
        
        {/* Type Badge */}
        <div className="absolute top-3 left-3">
          <Badge className={certificate.certificate_type === 'diploma' ? 'bg-purple-500' : 'bg-primary'}>
            {certificate.certificate_type === 'diploma' ? 'Diploma' : 'Certificate'}
          </Badge>
        </div>
        
        {/* Verified Badge */}
        {certificate.is_verified && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-400">
              <CheckCircle className="w-3 h-3" />
              Verified
            </Badge>
          </div>
        )}
      </div>
      
      {/* Certificate Info */}
      <div className="p-4">
        <h4 className="font-semibold line-clamp-2 mb-1">{courseTitle}</h4>
        <p className="text-sm text-muted-foreground mb-3">{instructorName}</p>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {format(new Date(certificate.issue_date), 'MMM d, yyyy')}
          </div>
          <span className="font-mono">{certificate.certificate_number}</span>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 gap-2"
            onClick={onDownload}
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open(`/verify/${certificate.certificate_number}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
