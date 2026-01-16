import { useState } from 'react';
import { ArrowLeft, Stethoscope, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const SymptomChecker = () => {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [duration, setDuration] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    possibleConditions: { name: string; likelihood: string; description: string }[];
    recommendations: string[];
    urgency: string;
    disclaimer: string;
  } | null>(null);

  const addSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom('');
    }
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const handleAnalyze = async () => {
    if (symptoms.length === 0) {
      toast.error('Please add at least one symptom');
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'user',
              content: `Based on these symptoms: ${symptoms.join(', ')}
              Duration: ${duration || 'Not specified'}
              
              Provide GENERAL EDUCATIONAL information (NOT a diagnosis) in JSON format:
              {
                "possibleConditions": [
                  { "name": "Condition name", "likelihood": "Common/Less Common/Rare", "description": "Brief description" }
                ],
                "recommendations": ["General recommendation 1", "Recommendation 2", ...],
                "urgency": "low/moderate/high/emergency",
                "disclaimer": "Important disclaimer about seeking medical care"
              }
              
              CRITICAL: Emphasize this is educational only, not a diagnosis. Always recommend consulting a healthcare professional.`
            }
          ],
          systemPrompt: 'You are a health education assistant. Provide general educational information about symptoms. NEVER diagnose. Always emphasize the importance of consulting a doctor. Be cautious and recommend professional care.'
        }
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setResult(parsed);
          toast.success('Analysis complete');
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Symptom Checker</h1>
            <p className="text-sm text-muted-foreground">Educational symptom analysis</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Important Disclaimer */}
        <Card className="p-4 bg-red-500/10 border-red-500/30">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-600 dark:text-red-400">Important Disclaimer</p>
              <p className="text-red-600/80 dark:text-red-400/80">
                This tool is for educational purposes ONLY. It does NOT provide medical diagnoses. 
                Always consult a qualified healthcare professional for medical advice.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Enter Your Symptoms</h3>
            </div>

            <div className="flex gap-2">
              <Input
                value={currentSymptom}
                onChange={(e) => setCurrentSymptom(e.target.value)}
                placeholder="e.g., headache, fatigue..."
                onKeyDown={(e) => e.key === 'Enter' && addSymptom()}
              />
              <Button onClick={addSymptom} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {symptoms.map((symptom) => (
                  <span 
                    key={symptom}
                    className="px-3 py-1 bg-primary/20 rounded-full text-sm flex items-center gap-2"
                  >
                    {symptom}
                    <button onClick={() => removeSymptom(symptom)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="How long have you had these symptoms? (optional)"
            />

            <Button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || symptoms.length === 0}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Get Information'
              )}
            </Button>
          </div>
        </Card>

        {result && (
          <>
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Urgency Level</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(result.urgency)}`}>
                    {result.urgency.charAt(0).toUpperCase() + result.urgency.slice(1)}
                  </span>
                </div>
                {result.urgency === 'emergency' && (
                  <p className="text-sm text-red-500 font-medium">
                    Please seek immediate medical attention!
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Possible Related Conditions</h3>
                <p className="text-xs text-muted-foreground">
                  These are for educational reference only, not diagnoses.
                </p>
                <div className="space-y-3">
                  {result.possibleConditions.map((condition, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{condition.name}</span>
                        <span className="text-xs text-muted-foreground">{condition.likelihood}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{condition.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-3">
                <h3 className="font-semibold">Recommendations</h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-primary">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card className="p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground">{result.disclaimer}</p>
            </Card>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SymptomChecker;
