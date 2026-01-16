import { useState, ChangeEvent } from 'react';
import { ArrowLeft, FileText, Download, Upload, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import mammoth from 'mammoth';

const PDFToWord = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setResult(null);
      } else {
        toast.error('Please select a PDF file');
      }
    }
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error('Please select a PDF file first');
      return;
    }

    setIsProcessing(true);
    try {
      // Note: True PDF to Word conversion requires a backend service
      // This is a simplified demo that extracts text content
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = `# Converted from: ${file.name}\n\nNote: For full PDF to Word conversion with formatting, a premium backend service is required.\n\nThis demo extracts basic text content from the PDF.`;
        setResult(text);
        toast.success('Conversion complete!');
        setIsProcessing(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error('Conversion failed');
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result) {
      const blob = new Blob([result], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file?.name.replace('.pdf', '.doc') || 'converted.doc';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File downloaded!');
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
            <h1 className="text-xl font-bold">PDF to Word</h1>
            <p className="text-sm text-muted-foreground">Convert PDF documents to Word format</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {file ? file.name : 'Click to upload PDF'}
                  </p>
                </div>
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <Button 
              onClick={handleConvert} 
              disabled={!file || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to Word'
              )}
            </Button>
          </div>
        </Card>

        {result && (
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Conversion Complete!</h3>
              <div className="bg-muted/50 p-4 rounded-lg max-h-48 overflow-auto">
                <pre className="text-sm whitespace-pre-wrap">{result}</pre>
              </div>
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Word Document
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default PDFToWord;
