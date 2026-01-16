import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Upload, Scissors, Loader2, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';

const PDFSplit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [splitPages, setSplitPages] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrls, setResultUrls] = useState<{ name: string; url: string }[]>([]);

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
    setResultUrls([]);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPageCount(pdf.getPageCount());
      setSplitPages(`1-${pdf.getPageCount()}`);
    } catch (error) {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleSplit = async () => {
    if (!file) return;

    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      
      // Parse split pages (e.g., "1-3, 5, 7-9")
      const ranges = splitPages.split(',').map(s => s.trim());
      const results: { name: string; url: string }[] = [];

      for (const range of ranges) {
        const newPdf = await PDFDocument.create();
        
        if (range.includes('-')) {
          const [start, end] = range.split('-').map(n => parseInt(n.trim()) - 1);
          const pages = [];
          for (let i = start; i <= end && i < pdf.getPageCount(); i++) {
            pages.push(i);
          }
          const copiedPages = await newPdf.copyPages(pdf, pages);
          copiedPages.forEach(page => newPdf.addPage(page));
        } else {
          const pageIndex = parseInt(range) - 1;
          if (pageIndex >= 0 && pageIndex < pdf.getPageCount()) {
            const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
            newPdf.addPage(copiedPage);
          }
        }

        if (newPdf.getPageCount() > 0) {
          const pdfBytes = await newPdf.save();
          const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          results.push({
            name: `split_${range.replace('-', '_to_')}.pdf`,
            url,
          });
        }
      }

      setResultUrls(results);

      toast({
        title: 'PDF split!',
        description: `Created ${results.length} PDF file(s)`,
      });
    } catch (error: any) {
      console.error('Split error:', error);
      toast({
        title: 'Split failed',
        description: error.message || 'Failed to split PDF',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  const handleDownloadAll = () => {
    resultUrls.forEach(({ url, name }) => {
      setTimeout(() => handleDownload(url, name), 100);
    });
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
              <h1 className="text-lg font-semibold">Split PDF</h1>
              <p className="text-xs text-muted-foreground">Extract pages from a PDF</p>
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
                      <p className="text-xs text-muted-foreground">{pageCount} pages</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-1">Drop PDF file here or click to upload</p>
                      <p className="text-xs text-muted-foreground">Select a PDF to split</p>
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

          {file && pageCount > 0 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label>Pages to extract</Label>
                  <Input
                    value={splitPages}
                    onChange={(e) => setSplitPages(e.target.value)}
                    placeholder="e.g., 1-3, 5, 7-9"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use commas to separate ranges. PDF has {pageCount} pages.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSplit}
            disabled={!file || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Splitting...
              </>
            ) : (
              <>
                <Scissors className="w-5 h-5 mr-2" />
                Split PDF
              </>
            )}
          </Button>

          {resultUrls.length > 0 && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-3">
                  ✓ PDF split into {resultUrls.length} file(s)!
                </p>
                <div className="space-y-2 mb-4">
                  {resultUrls.map(({ name, url }, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="text-sm truncate">{name}</span>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(url, name)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {resultUrls.length > 1 && (
                  <Button onClick={handleDownloadAll} className="w-full">
                    <Download className="w-5 h-5 mr-2" />
                    Download All
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
};

export default PDFSplit;
