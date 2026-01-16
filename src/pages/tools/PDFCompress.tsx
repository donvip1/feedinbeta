import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, Minimize2, Loader2, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';

const PDFCompress = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; originalSize: number; newSize: number } | null>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      toast({
        title: 'Invalid file',
        description: 'Please select a PDF file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
  }, [toast]);

  const handleCompress = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { 
        ignoreEncryption: true 
      });

      // Remove metadata to reduce size
      pdf.setTitle('');
      pdf.setAuthor('');
      pdf.setSubject('');
      pdf.setKeywords([]);
      pdf.setProducer('FeedIn AI Tools');
      pdf.setCreator('FeedIn AI Tools');

      const compressedBytes = await pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const blob = new Blob([compressedBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setResult({
        url,
        originalSize: file.size,
        newSize: compressedBytes.byteLength,
      });

      const reduction = ((file.size - compressedBytes.byteLength) / file.size * 100).toFixed(1);
      toast({
        title: 'PDF compressed!',
        description: `Reduced file size by ${reduction}%`,
      });
    } catch (error: any) {
      console.error('Compress error:', error);
      toast({
        title: 'Compression failed',
        description: error.message || 'Failed to compress PDF',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `compressed_${file?.name || 'document.pdf'}`;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
              <h1 className="text-lg font-semibold">Compress PDF</h1>
              <p className="text-xs text-muted-foreground">Reduce PDF file size</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6">
              <label className="block">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  {file ? (
                    <div>
                      <FileText className="w-12 h-12 mx-auto mb-4 text-primary" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drop PDF file here or click to upload</p>
                      <p className="text-xs text-muted-foreground">Select a PDF to compress</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCompress}
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Compressing...
              </>
            ) : (
              <>
                <Minimize2 className="w-5 h-5 mr-2" />
                Compress PDF
              </>
            )}
          </Button>

          {result && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                  ✓ PDF compressed successfully!
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="p-3 bg-background rounded">
                    <p className="text-muted-foreground">Original</p>
                    <p className="font-medium">{formatSize(result.originalSize)}</p>
                  </div>
                  <div className="p-3 bg-background rounded">
                    <p className="text-muted-foreground">Compressed</p>
                    <p className="font-medium">{formatSize(result.newSize)}</p>
                  </div>
                </div>
                <p className="text-sm text-center mb-4">
                  Reduced by {((result.originalSize - result.newSize) / result.originalSize * 100).toFixed(1)}%
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Download Compressed PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default PDFCompress;
