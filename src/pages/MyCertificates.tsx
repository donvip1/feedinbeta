import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, Download, Search, Filter, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CertificateCard } from '@/components/learn/CertificateCard';
import { useUserCertificates } from '@/hooks/useLearnData';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const MyCertificates = () => {
  const navigate = useNavigate();
  const { data: certificates, isLoading } = useUserCertificates();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');

  const filteredCertificates = React.useMemo(() => {
    if (!certificates) return [];
    
    return certificates.filter(cert => {
      const matchesSearch = cert.course?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.certificate_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || cert.certificate_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [certificates, searchQuery, filterType]);

  const handleDownload = async (certificate: any) => {
    // For now, open certificate URL if available
    if (certificate.certificate_url) {
      window.open(certificate.certificate_url, '_blank');
    } else {
      toast.info('Certificate PDF generation coming soon!');
    }
  };

  const diplomaCount = certificates?.filter(c => c.certificate_type === 'diploma').length || 0;
  const certificateCount = certificates?.filter(c => c.certificate_type !== 'diploma').length || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">My Certificates</h1>
            <p className="text-sm text-muted-foreground">Your earned credentials</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl p-4 border border-primary/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificateCount}</p>
                <p className="text-sm text-muted-foreground">Certificates</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 rounded-xl p-4 border border-purple-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{diplomaCount}</p>
                <p className="text-sm text-muted-foreground">Diplomas</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search certificates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="certificate">Certificates</SelectItem>
              <SelectItem value="diploma">Diplomas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Certificates Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : filteredCertificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCertificates.map((certificate, index) => (
              <motion.div
                key={certificate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <CertificateCard
                  certificate={{
                    id: certificate.id,
                    certificate_number: certificate.certificate_number,
                    certificate_type: certificate.certificate_type || undefined,
                    issue_date: certificate.issue_date || new Date().toISOString(),
                    certificate_url: certificate.certificate_url || undefined,
                    is_verified: certificate.is_verified || undefined,
                    course: certificate.course ? {
                      title: certificate.course.title,
                      thumbnail_url: certificate.course.thumbnail_url || undefined,
                      instructor: certificate.course.instructor ? {
                        profiles: certificate.course.instructor.profiles ? {
                          display_name: certificate.course.instructor.profiles.display_name || undefined,
                        } : undefined,
                      } : undefined,
                    } : undefined,
                    metadata: certificate.metadata && typeof certificate.metadata === 'object' && !Array.isArray(certificate.metadata) ? {
                      course_title: (certificate.metadata as any).course_title || undefined,
                      instructor_name: (certificate.metadata as any).instructor_name || undefined,
                      completion_date: (certificate.metadata as any).completion_date || undefined,
                    } : undefined,
                  }}
                  onDownload={() => handleDownload(certificate)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Award className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Certificates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Complete courses to earn certificates and diplomas
            </p>
            <Button onClick={() => navigate('/ai/learn')}>
              Browse Courses
            </Button>
          </motion.div>
        )}

        {/* Download All Button */}
        {filteredCertificates.length > 0 && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" className="gap-2" onClick={() => toast.info('Bulk download coming soon!')}>
              <Download className="w-4 h-4" />
              Download All as PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyCertificates;
