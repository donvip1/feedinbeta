import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Languages, Loader2, Copy, Download, ArrowLeftRight, Volume2, CheckCircle2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedMarkdownRenderer } from '@/components/ai/EnhancedMarkdownRenderer';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 5;

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
  { code: 'tl', name: 'Filipino', flag: '🇵🇭' },
  { code: 'sw', name: 'Swahili', flag: '🇰🇪' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
];

const Translator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'translator',
    creditCost: CREDIT_COST,
  });
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

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsProcessing(true);
    setResult('');

    try {
      const sourceLanguage = sourceLang === 'auto' ? 'the detected language' : LANGUAGES.find(l => l.code === sourceLang)?.name;
      const targetLanguage = LANGUAGES.find(l => l.code === targetLang)?.name;
      const targetFlag = LANGUAGES.find(l => l.code === targetLang)?.flag;

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

## Response Format:

${sourceLang === 'auto' ? '### 🔍 Detected Language\n**[Language Name]**\n\n---\n\n' : ''}### ${targetFlag} Translation

[Your accurate translation here - preserve meaning, tone, and formatting]

---

### 📝 Translation Notes (if relevant)

- Any cultural context or nuances
- Alternative translations for specific phrases
- Formality level maintained

Provide natural, fluent translations. Preserve the original meaning, tone, and formatting.`,
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
                  setResult(fullResponse);
                }
              } catch {}
            }
          }
        }
      }

      toast({
        title: '✅ Translation complete!',
        description: `Translated to ${targetLanguage}`,
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
        setInputText(result.split('\n')[0] || '');
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

  const speakText = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    speechSynthesis.speak(utterance);
  };

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Languages className="w-5 h-5 text-primary" />
              AI Translator
            </h1>
            <p className="text-xs text-muted-foreground">Translate between 30+ languages with AI</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            {CREDIT_COST}
          </div>
        </div>
      </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Language Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="From" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔍 Auto-detect</SelectItem>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSwapLanguages}
                    disabled={sourceLang === 'auto'}
                    className="shrink-0"
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
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter text to translate..."
                    className="min-h-[150px] resize-none text-base pr-10"
                  />
                  {inputText && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-8 w-8"
                      onClick={() => speakText(inputText, sourceLang === 'auto' ? 'en' : sourceLang)}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {inputText.length} characters
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInputText('')}
                    disabled={!inputText}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <Button
            className="w-full h-12 text-base font-medium"
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

          {/* Result */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-blue-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <p className="text-sm font-semibold">
                          {LANGUAGES.find(l => l.code === targetLang)?.flag} Translation Result
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => speakText(result, targetLang)} className="h-8 w-8 p-0">
                          <Volume2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCopy} className="h-8 w-8 p-0">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDownload} className="h-8 w-8 p-0">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <EnhancedMarkdownRenderer content={result} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default Translator;
