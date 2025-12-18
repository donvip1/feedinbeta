import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Globe, Check, Loader2 } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
];

const LanguageSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadLanguagePreference();
  }, [user]);

  const loadLanguagePreference = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      if (data?.preferred_language) {
        setSelectedLanguage(data.preferred_language);
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: selectedLanguage })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Language Updated',
        description: 'Your language preference has been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update language preference.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center space-x-3">
            <Button onClick={() => navigate('/settings')} size="sm" variant="ghost">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Globe className="w-5 h-5 text-primary" />
            <span className="text-xl font-bold">Language</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl pb-24">
        <Card className="bg-card border-border p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Select Language</h2>
            <p className="text-muted-foreground">
              Choose your preferred language for the app interface.
            </p>
          </div>

          {initialLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <RadioGroup
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
              className="space-y-2"
            >
              {languages.map((language) => (
                <div
                  key={language.code}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedLanguage === language.code
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-secondary/50'
                  }`}
                  onClick={() => setSelectedLanguage(language.code)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{language.flag}</span>
                    <div>
                      <Label
                        htmlFor={language.code}
                        className="font-semibold cursor-pointer"
                      >
                        {language.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {language.nativeName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedLanguage === language.code && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                    <RadioGroupItem
                      value={language.code}
                      id={language.code}
                      className="sr-only"
                    />
                  </div>
                </div>
              ))}
            </RadioGroup>
          )}

          <Button
            onClick={handleSave}
            disabled={loading || initialLoading}
            className="w-full mt-6 bg-gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Language'
            )}
          </Button>
        </Card>

        {/* Info Card */}
        <Card className="bg-card border-border mt-6 p-6">
          <h3 className="font-bold mb-2">Note</h3>
          <p className="text-sm text-muted-foreground">
            Language preference affects app interface and notifications. 
            User-generated content will appear in its original language.
          </p>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default LanguageSettings;
