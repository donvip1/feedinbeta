import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Video, FileText, HelpCircle, CheckCircle,
  ChevronRight, ChevronLeft, Upload, Plus, Trash2, GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const steps = [
  { id: 1, title: 'Basic Info', icon: BookOpen },
  { id: 2, title: 'Course Content', icon: Video },
  { id: 3, title: 'Assessments', icon: HelpCircle },
  { id: 4, title: 'Pricing', icon: FileText },
  { id: 5, title: 'Review', icon: CheckCircle },
];

const CreateCourse = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [courseData, setCourseData] = useState({
    title: '',
    shortDescription: '',
    description: '',
    category: '',
    level: '',
    language: 'en',
    thumbnailUrl: '',
    modules: [{ title: '', lessons: [{ title: '', videoUrl: '', duration: '' }] }],
    creditCost: 30,
  });

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePublish = async () => {
    toast.success('Course published successfully!');
    navigate('/ai/learn/instructor/dashboard');
  };

  const addModule = () => {
    setCourseData({
      ...courseData,
      modules: [...courseData.modules, { title: '', lessons: [{ title: '', videoUrl: '', duration: '' }] }],
    });
  };

  const addLesson = (moduleIndex: number) => {
    const newModules = [...courseData.modules];
    newModules[moduleIndex].lessons.push({ title: '', videoUrl: '', duration: '' });
    setCourseData({ ...courseData, modules: newModules });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Course Title</Label>
              <Input
                id="title"
                placeholder="e.g., Complete React Developer Course"
                value={courseData.title}
                onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="shortDesc">Short Description</Label>
              <Input
                id="shortDesc"
                placeholder="Brief overview (max 160 characters)"
                maxLength={160}
                value={courseData.shortDescription}
                onChange={(e) => setCourseData({ ...courseData, shortDescription: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Full Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed course description..."
                rows={5}
                value={courseData.description}
                onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={courseData.category} onValueChange={(v) => setCourseData({ ...courseData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web-dev">Web Development</SelectItem>
                    <SelectItem value="mobile-dev">Mobile Development</SelectItem>
                    <SelectItem value="data-science">Data Science</SelectItem>
                    <SelectItem value="ai-ml">AI & Machine Learning</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Level</Label>
                <Select value={courseData.level} onValueChange={(v) => setCourseData({ ...courseData, level: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="thumbnail">Thumbnail URL</Label>
              <Input
                id="thumbnail"
                placeholder="https://..."
                value={courseData.thumbnailUrl}
                onChange={(e) => setCourseData({ ...courseData, thumbnailUrl: e.target.value })}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Course Modules</h3>
              <Button variant="outline" size="sm" onClick={addModule}>
                <Plus className="w-4 h-4 mr-1" /> Add Module
              </Button>
            </div>

            {courseData.modules.map((module, moduleIndex) => (
              <Card key={moduleIndex}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={`Module ${moduleIndex + 1} title`}
                      value={module.title}
                      onChange={(e) => {
                        const newModules = [...courseData.modules];
                        newModules[moduleIndex].title = e.target.value;
                        setCourseData({ ...courseData, modules: newModules });
                      }}
                    />
                  </div>

                  <div className="ml-6 space-y-2">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <div key={lessonIndex} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Video className="w-4 h-4 text-muted-foreground" />
                        <Input
                          className="flex-1"
                          placeholder={`Lesson ${lessonIndex + 1} title`}
                          value={lesson.title}
                          onChange={(e) => {
                            const newModules = [...courseData.modules];
                            newModules[moduleIndex].lessons[lessonIndex].title = e.target.value;
                            setCourseData({ ...courseData, modules: newModules });
                          }}
                        />
                        <Input
                          className="w-24"
                          placeholder="Duration"
                          value={lesson.duration}
                          onChange={(e) => {
                            const newModules = [...courseData.modules];
                            newModules[moduleIndex].lessons[lessonIndex].duration = e.target.value;
                            setCourseData({ ...courseData, modules: newModules });
                          }}
                        />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addLesson(moduleIndex)}>
                      <Plus className="w-3 h-3 mr-1" /> Add Lesson
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Add quizzes and assessments to test student knowledge. Students must score 80% or higher to earn a certificate.
            </p>
            
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Assessment builder coming soon</p>
                <p className="text-sm">You can add assessments after publishing</p>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="price">Credit Cost</Label>
              <Input
                id="price"
                type="number"
                min={10}
                max={500}
                value={courseData.creditCost}
                onChange={(e) => setCourseData({ ...courseData, creditCost: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: 30-50 for certificates, 100-200 for diplomas
              </p>
            </div>

            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">Your Earnings</h4>
                <div className="text-2xl font-bold text-primary">
                  {Math.floor(courseData.creditCost * 0.7)} credits
                </div>
                <p className="text-sm text-muted-foreground">70% of each enrollment</p>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <span className="text-sm text-muted-foreground">Title</span>
                  <p className="font-medium">{courseData.title || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Category</span>
                  <p className="font-medium">{courseData.category || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Level</span>
                  <p className="font-medium">{courseData.level || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Modules</span>
                  <p className="font-medium">{courseData.modules.length}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Lessons</span>
                  <p className="font-medium">
                    {courseData.modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Price</span>
                  <p className="font-medium">{courseData.creditCost} credits</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="Create Course" onBack={() => navigate('/ai/learn/instructor/dashboard')} />
      
      <div className="p-4 space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Step {currentStep} of 5</span>
            <span>{steps[currentStep - 1].title}</span>
          </div>
          <Progress value={(currentStep / 5) * 100} />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex flex-col items-center ${
                step.id <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.id < currentStep 
                  ? 'bg-primary text-white' 
                  : step.id === currentStep 
                    ? 'bg-primary/20 border-2 border-primary' 
                    : 'bg-muted'
              }`}>
                {step.id < currentStep ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <step.icon className="w-4 h-4" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {renderStepContent()}
        </motion.div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          
          {currentStep < 5 ? (
            <Button onClick={handleNext} className="flex-1">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handlePublish} className="flex-1">
              Publish Course
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCourse;
