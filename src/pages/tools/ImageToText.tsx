import { useState, useCallback, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, ScanText, Loader2, Copy, Download, Image, Sparkles, FileText, Check, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 5;

const ImageToText = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'image_to_text',
    creditCost: CREDIT_COST,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [result, setResult] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setResult('');
    setProgress(0);
    setConfidence(0);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      setResult('');
      setProgress(0);
      setConfidence(0);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(droppedFile);
    }
  }, []);

  const handleExtract = async () => {
    if (!preview) return;

    const success = await checkAndDeductCredits();
    if (!success) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(preview, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
            setProgressStatus('Recognizing text...');
          } else if (m.status === 'loading language traineddata') {
            setProgressStatus('Loading language data...');
          } else if (m.status === 'initializing tesseract') {
            setProgressStatus('Initializing OCR...');
          }
        },
      });

      setResult(result.data.text);
      setConfidence(Math.round(result.data.confidence));

      toast({
        title: 'Text extracted!',
        description: `Found ${result.data.text.split(/\s+/).filter(Boolean).length} words with ${Math.round(result.data.confidence)}% confidence`,
      });
    } catch (error: any) {
      console.error('OCR error:', error);
      toast({
        title: 'Extraction failed',
        description: error.message || 'Failed to extract text',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-text-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = result.split(/\s+/).filter(Boolean).length;

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
                <ScanText className="w-5 h-5 text-primary" />
                Image to Text (OCR)
              </h1>
              <p className="text-xs text-muted-foreground">Extract text from images</p>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>{CREDIT_COST}</span>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Upload Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="overflow-hidden border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors">
              <CardContent className="p-0">
                <label 
                  className="block cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  {preview ? (
                    <div className="relative">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full max-h-64 object-contain bg-muted"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Image className="w-4 h-4" />
                          {file?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click or drop to change image
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Upload className="w-16 h-16 mx-auto mb-4 text-primary/60" />
                      </motion.div>
                      <p className="text-lg font-medium mb-1">Drop image here</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        or click to upload
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['JPG', 'PNG', 'WebP', 'GIF', 'BMP'].map((format) => (
                          <span 
                            key={format}
                            className="px-2 py-1 bg-muted rounded text-xs"
                          >
                            {format}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </CardContent>
            </Card>
          </motion.div>

          {/* Progress Card */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card className="overflow-hidden bg-gradient-to-r from-primary/10 to-purple-500/10">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">{progressStatus}</span>
                      <span className="ml-auto text-sm text-primary font-mono">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Extract Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Button
              className="w-full h-14 text-lg"
              size="lg"
              onClick={handleExtract}
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <ScanText className="w-5 h-5 mr-2" />
                  Extract Text
                </>
              )}
            </Button>
          </motion.div>

          {/* Result Card */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card className="border-green-500/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-500" />
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          Extracted Text
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-1 rounded">
                          {confidence}% confidence
                        </span>
                        <Button size="sm" variant="ghost" onClick={handleCopy}>
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleDownload}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="bg-muted/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{result}</p>
                    </div>
                    <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                      <span>{wordCount} words</span>
                      <span>{result.length} characters</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tips Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Tips for Better Results</h4>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li>• Use clear, high-resolution images</li>
                      <li>• Ensure good lighting and contrast</li>
                      <li>• Avoid tilted or skewed text</li>
                      <li>• Works best with printed text</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default ImageToText;