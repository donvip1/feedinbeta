import { useState, useCallback, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, Merge, Loader2, Download, X, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';

const PDFMerge = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf');
    
    if (pdfFiles.length !== selectedFiles.length) {
      toast({
        title: 'Invalid files',
        description: 'Only PDF files are allowed',
        variant: 'destructive',
      });
    }
    
    setFiles(prev => [...prev, ...pdfFiles]);
    setResultUrl(null);
  }, [toast]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResultUrl(null);
  };

  const moveFile = (from: number, to: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      const [removed] = newFiles.splice(from, 1);
      newFiles.splice(to, 0, removed);
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: 'Need more files',
        description: 'Please add at least 2 PDF files to merge',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      toast({
        title: 'PDFs merged!',
        description: `Combined ${files.length} PDFs into one file`,
      });
    } catch (error: any) {
      console.error('Merge error:', error);
      toast({
        title: 'Merge failed',
        description: error.message || 'Failed to merge PDFs',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = 'merged.pdf';
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
              <h1 className="text-lg font-semibold">Merge PDFs</h1>
              <p className="text-xs text-muted-foreground">Combine multiple PDFs into one</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          <Card>
            <CardContent className="p-6">
              <label className="block">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Drop PDF files here or click to upload</p>
                  <p className="text-xs text-muted-foreground">Add multiple PDF files to merge</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Files to merge ({files.length})</p>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <div className="flex gap-1">
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveFile(index, index - 1)}
                          >
                            ↑
                          </Button>
                        )}
                        {index < files.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveFile(index, index + 1)}
                          >
                            ↓
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="w-5 h-5 mr-2" />
                Merge {files.length} PDFs
              </>
            )}
          </Button>

          {resultUrl && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                  ✓ PDFs merged successfully!
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Download Merged PDF
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

export default PDFMerge;
