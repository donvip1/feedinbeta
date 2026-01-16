import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, ScanText, Loader2, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';

const ImageToText = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState('');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }, [toast]);

  const handleExtract = async () => {
    if (!preview) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(preview, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      setResult(result.data.text);

      toast({
        title: 'Text extracted!',
        description: `Found ${result.data.text.split(/\s+/).filter(Boolean).length} words`,
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
    toast({ title: 'Copied to clipboard' });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_text.txt';
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
              <h1 className="text-lg font-semibold">Image to Text (OCR)</h1>
              <p className="text-xs text-muted-foreground">Extract text from images</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6">
              <label className="block">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  {preview ? (
                    <div>
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-h-48 mx-auto mb-4 rounded-lg object-contain"
                      />
                      <p className="text-sm font-medium">{file?.name}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drop image here or click to upload</p>
                      <p className="text-xs text-muted-foreground">
                        Supports JPG, PNG, WebP, GIF, BMP
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </CardContent>
          </Card>

          {isProcessing && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Extracting text...</span>
                  <span className="text-sm text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} />
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
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

          {result && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    ✓ Extracted Text
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
                <div className="bg-background p-3 rounded-lg max-h-64 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap font-mono">{result}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {result.split(/\s+/).filter(Boolean).length} words • {result.length} characters
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Tips for better results:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Use clear, high-resolution images</li>
                <li>Ensure good lighting and contrast</li>
                <li>Avoid tilted or skewed text</li>
                <li>Works best with printed text</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default ImageToText;
