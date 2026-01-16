import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, Minimize2, Loader2, Download, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ImageCompressor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quality, setQuality] = useState([80]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; originalSize: number; newSize: number } | null>(null);

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
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }, [toast]);

  const handleCompress = async () => {
    if (!file || !preview) return;

    setIsProcessing(true);

    try {
      const img = new Image();
      img.src = preview;

      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(img, 0, 0);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality[0] / 100);
      
      // Convert data URL to blob
      const response = await fetch(compressedDataUrl);
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      setResult({
        url,
        originalSize: file.size,
        newSize: blob.size,
      });

      const reduction = ((file.size - blob.size) / file.size * 100).toFixed(1);
      toast({
        title: 'Image compressed!',
        description: `Reduced file size by ${reduction}%`,
      });
    } catch (error: any) {
      console.error('Compress error:', error);
      toast({
        title: 'Compression failed',
        description: error.message || 'Failed to compress image',
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
    a.download = `compressed_${file?.name || 'image.jpg'}`;
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
              <h1 className="text-lg font-semibold">Image Compressor</h1>
              <p className="text-xs text-muted-foreground">Reduce image file size</p>
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
                      <p className="text-xs text-muted-foreground">{formatSize(file?.size || 0)}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drop image here or click to upload</p>
                      <p className="text-xs text-muted-foreground">Supports JPG, PNG, WebP</p>
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

          {file && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Quality</label>
                    <span className="text-sm text-muted-foreground">{quality[0]}%</span>
                  </div>
                  <Slider
                    value={quality}
                    onValueChange={setQuality}
                    min={10}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower quality = smaller file size
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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
                Compress Image
              </>
            )}
          </Button>

          {result && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                  ✓ Image compressed successfully!
                </p>
                
                <img
                  src={result.url}
                  alt="Compressed"
                  className="max-h-48 mx-auto mb-4 rounded-lg object-contain"
                />

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
                  Download Compressed Image
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

export default ImageCompressor;
