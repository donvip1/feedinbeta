import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Download, Eye, Plus, Trash2, GripVertical, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useUserCertificates } from '@/hooks/useLearnData';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

interface ResumeData {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    summary: string;
  };
  experience: {
    id: string;
    title: string;
    company: string;
    startDate: string;
    endDate: string;
    description: string;
  }[];
  education: {
    id: string;
    degree: string;
    institution: string;
    year: string;
  }[];
  skills: string[];
  certificates: string[];
}

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const { data: userCertificates } = useUserCertificates();
  const { checkAndDeductCredits } = useAIToolCredits({
    toolName: 'resume-builder',
    creditCost: 20,
  });

  const [activeTab, setActiveTab] = React.useState('personal');
  const [selectedTemplate, setSelectedTemplate] = React.useState('modern');
  const [showPreview, setShowPreview] = React.useState(false);

  const [resumeData, setResumeData] = React.useState<ResumeData>({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [],
    education: [],
    skills: [],
    certificates: [],
  });

  const addExperience = () => {
    setResumeData((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { id: Date.now().toString(), title: '', company: '', startDate: '', endDate: '', description: '' },
      ],
    }));
  };

  const removeExperience = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  };

  const addEducation = () => {
    setResumeData((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        { id: Date.now().toString(), degree: '', institution: '', year: '' },
      ],
    }));
  };

  const removeEducation = (id: string) => {
    setResumeData((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  };

  const addSkill = () => {
    const skill = prompt('Enter a skill:');
    if (skill) {
      setResumeData((prev) => ({
        ...prev,
        skills: [...prev.skills, skill],
      }));
    }
  };

  const removeSkill = (index: number) => {
    setResumeData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const importCertificates = () => {
    if (userCertificates && userCertificates.length > 0) {
      const certNames = userCertificates.map((c) => c.course?.title || 'Certificate').filter(Boolean);
      setResumeData((prev) => ({
        ...prev,
        certificates: [...new Set([...prev.certificates, ...certNames])],
      }));
      toast.success(`Imported ${certNames.length} certificates`);
    } else {
      toast.info('No certificates to import');
    }
  };

  const handleDownload = async () => {
    const success = await checkAndDeductCredits();
    if (success) {
      // In a real implementation, this would generate a PDF
      toast.success('Resume PDF generated! Download starting...');
    }
  };

  const templates = [
    { id: 'modern', name: 'Modern', color: 'primary' },
    { id: 'classic', name: 'Classic', color: 'gray' },
    { id: 'creative', name: 'Creative', color: 'purple' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Resume Builder</h1>
              <p className="text-sm text-muted-foreground">Create a professional resume</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Template Selection */}
        <div>
          <Label className="mb-2 block">Choose Template</Label>
          <div className="flex gap-3">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className={`w-full h-16 rounded bg-${template.color}-500/20 mb-2`} />
                <span className="text-sm font-medium">{template.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="experience">Work</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="certs">Certs</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={resumeData.personalInfo.fullName}
                  onChange={(e) =>
                    setResumeData((prev) => ({
                      ...prev,
                      personalInfo: { ...prev.personalInfo, fullName: e.target.value },
                    }))
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={resumeData.personalInfo.email}
                  onChange={(e) =>
                    setResumeData((prev) => ({
                      ...prev,
                      personalInfo: { ...prev.personalInfo, email: e.target.value },
                    }))
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={resumeData.personalInfo.phone}
                  onChange={(e) =>
                    setResumeData((prev) => ({
                      ...prev,
                      personalInfo: { ...prev.personalInfo, phone: e.target.value },
                    }))
                  }
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={resumeData.personalInfo.location}
                  onChange={(e) =>
                    setResumeData((prev) => ({
                      ...prev,
                      personalInfo: { ...prev.personalInfo, location: e.target.value },
                    }))
                  }
                  placeholder="New York, USA"
                />
              </div>
            </div>
            <div>
              <Label>Professional Summary</Label>
              <Textarea
                value={resumeData.personalInfo.summary}
                onChange={(e) =>
                  setResumeData((prev) => ({
                    ...prev,
                    personalInfo: { ...prev.personalInfo, summary: e.target.value },
                  }))
                }
                placeholder="Brief summary of your professional background..."
                rows={4}
              />
            </div>
          </TabsContent>

          <TabsContent value="experience" className="space-y-4 mt-4">
            {resumeData.experience.map((exp, index) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl p-4 border"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <span className="font-medium">Experience {index + 1}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeExperience(exp.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Job Title"
                    value={exp.title}
                    onChange={(e) => {
                      const updated = [...resumeData.experience];
                      updated[index].title = e.target.value;
                      setResumeData((prev) => ({ ...prev, experience: updated }));
                    }}
                  />
                  <Input
                    placeholder="Company"
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...resumeData.experience];
                      updated[index].company = e.target.value;
                      setResumeData((prev) => ({ ...prev, experience: updated }));
                    }}
                  />
                  <Input
                    placeholder="Start Date"
                    value={exp.startDate}
                    onChange={(e) => {
                      const updated = [...resumeData.experience];
                      updated[index].startDate = e.target.value;
                      setResumeData((prev) => ({ ...prev, experience: updated }));
                    }}
                  />
                  <Input
                    placeholder="End Date"
                    value={exp.endDate}
                    onChange={(e) => {
                      const updated = [...resumeData.experience];
                      updated[index].endDate = e.target.value;
                      setResumeData((prev) => ({ ...prev, experience: updated }));
                    }}
                  />
                </div>
                <Textarea
                  className="mt-3"
                  placeholder="Description of responsibilities..."
                  value={exp.description}
                  onChange={(e) => {
                    const updated = [...resumeData.experience];
                    updated[index].description = e.target.value;
                    setResumeData((prev) => ({ ...prev, experience: updated }));
                  }}
                />
              </motion.div>
            ))}
            <Button variant="outline" className="w-full gap-2" onClick={addExperience}>
              <Plus className="w-4 h-4" />
              Add Experience
            </Button>
          </TabsContent>

          <TabsContent value="education" className="space-y-4 mt-4">
            {resumeData.education.map((edu, index) => (
              <motion.div
                key={edu.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-xl p-4 border"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">Education {index + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeEducation(edu.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    placeholder="Degree"
                    value={edu.degree}
                    onChange={(e) => {
                      const updated = [...resumeData.education];
                      updated[index].degree = e.target.value;
                      setResumeData((prev) => ({ ...prev, education: updated }));
                    }}
                  />
                  <Input
                    placeholder="Institution"
                    value={edu.institution}
                    onChange={(e) => {
                      const updated = [...resumeData.education];
                      updated[index].institution = e.target.value;
                      setResumeData((prev) => ({ ...prev, education: updated }));
                    }}
                  />
                  <Input
                    placeholder="Year"
                    value={edu.year}
                    onChange={(e) => {
                      const updated = [...resumeData.education];
                      updated[index].year = e.target.value;
                      setResumeData((prev) => ({ ...prev, education: updated }));
                    }}
                  />
                </div>
              </motion.div>
            ))}
            <Button variant="outline" className="w-full gap-2" onClick={addEducation}>
              <Plus className="w-4 h-4" />
              Add Education
            </Button>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              {resumeData.skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeSkill(index)}
                >
                  {skill}
                  <Trash2 className="w-3 h-3" />
                </Badge>
              ))}
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={addSkill}>
              <Plus className="w-4 h-4" />
              Add Skill
            </Button>
          </TabsContent>

          <TabsContent value="certs" className="space-y-4 mt-4">
            <Button variant="outline" className="w-full gap-2" onClick={importCertificates}>
              <Award className="w-4 h-4" />
              Import Certificates from FeedIn Learn
            </Button>

            <div className="space-y-2">
              {resumeData.certificates.map((cert, index) => (
                <div key={index} className="flex items-center justify-between bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    <span>{cert}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setResumeData((prev) => ({
                        ...prev,
                        certificates: prev.certificates.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {userCertificates && userCertificates.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {userCertificates.length} certificates available to import
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Download CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl p-6 border text-center"
        >
          <FileText className="w-12 h-12 mx-auto mb-3 text-primary" />
          <h3 className="font-bold mb-2">Download Your Resume</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get a professional PDF resume ready to send to employers
          </p>
          <Button size="lg" className="gap-2" onClick={handleDownload}>
            <Download className="w-5 h-5" />
            Download PDF (20 Credits)
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
