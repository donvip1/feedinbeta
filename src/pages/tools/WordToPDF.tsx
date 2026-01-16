import { useState, ChangeEvent } from 'react';
import { ArrowLeft, FileText, Download, Upload, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';

const WordToPDF = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.doc') || selectedFile.name.endsWith('.docx')) {
        setFile(selectedFile);
        setPdfUrl(null);
      } else {
        toast.error('Please select a Word document (.doc or .docx)');
      }
    }
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error('Please select a Word document first');
      return;
    }

    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      pdf.setFontSize(12);
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      let y = margin;
      const lineHeight = 7;
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (const line of lines) {
        if (y + lineHeight > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      }

      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      toast.success('Conversion complete!');
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Conversion failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a');
      a.href = pdfUrl;
      a.download = file?.name.replace(/\.(doc|docx)$/i, '.pdf') || 'converted.pdf';
      a.click();
      toast.success('PDF downloaded!');
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
            <h1 className="text-xl font-bold">Word to PDF</h1>
            <p className="text-sm text-muted-foreground">Convert Word documents to PDF format</p>
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
              <label htmlFor="word-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {file ? file.name : 'Click to upload Word document'}
                  </p>
                </div>
                <input
                  id="word-upload"
                  type="file"
                  accept=".doc,.docx"
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
                'Convert to PDF'
              )}
            </Button>
          </div>
        </Card>

        {pdfUrl && (
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Conversion Complete!</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-center">Your PDF is ready for download</p>
              </div>
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default WordToPDF;
