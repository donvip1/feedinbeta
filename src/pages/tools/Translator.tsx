import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Languages, Loader2, Copy, Download, ArrowLeftRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'tl', name: 'Filipino' },
  { code: 'sw', name: 'Swahili' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'ig', name: 'Igbo' },
  { code: 'ha', name: 'Hausa' },
];

const Translator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedLang, setDetectedLang] = useState('');

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'No text',
        description: 'Please enter some text to translate',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setResult('');

    try {
      const sourceLanguage = sourceLang === 'auto' ? 'the detected language' : LANGUAGES.find(l => l.code === sourceLang)?.name;
      const targetLanguage = LANGUAGES.find(l => l.code === targetLang)?.name;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional translator. Translate the text from ${sourceLanguage} to ${targetLanguage}. 
              
              If auto-detecting the language, first identify it.
              
              Format your response as:
              ${sourceLang === 'auto' ? 'DETECTED LANGUAGE: [language name]\n' : ''}TRANSLATION:
              [translated text]
              
              Preserve the original meaning, tone, and formatting. Do not add explanations.`,
            },
            {
              role: 'user',
              content: inputText,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error('Failed to translate');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  
                  // Parse detected language
                  const langMatch = fullResponse.match(/DETECTED LANGUAGE:\s*(\w+)/i);
                  if (langMatch) {
                    setDetectedLang(langMatch[1]);
                  }
                  
                  // Parse translation
                  const translationMatch = fullResponse.match(/TRANSLATION:\s*([\s\S]*)/i);
                  if (translationMatch) {
                    setResult(translationMatch[1].trim());
                  }
                }
              } catch {}
            }
          }
        }
      }

      toast({
        title: 'Translation complete!',
        description: detectedLang ? `Detected: ${detectedLang}` : undefined,
      });
    } catch (error: any) {
      console.error('Translation error:', error);
      toast({
        title: 'Translation failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang !== 'auto' && targetLang !== sourceLang) {
      const temp = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(temp);
      if (result) {
        setInputText(result);
        setResult('');
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    toast({ title: 'Copied to clipboard' });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translation.txt';
    a.click();
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Translator</h1>
              <p className="text-xs text-muted-foreground">Translate between 30+ languages</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="From" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSwapLanguages}
                  disabled={sourceLang === 'auto'}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </Button>

                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="To" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter text to translate..."
                className="min-h-[150px] resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {inputText.length} characters
                </span>
                {detectedLang && (
                  <span className="text-xs text-muted-foreground">
                    Detected: {detectedLang}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleTranslate}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="w-5 h-5 mr-2" />
                Translate
              </>
            )}
          </Button>

          {result && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ Translation ({LANGUAGES.find(l => l.code === targetLang)?.name})
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={handleCopy}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleDownload}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{result}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Translator;
