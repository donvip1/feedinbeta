import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, FileImage, Upload, X, Download, 
  Loader2, GripVertical, FileText, Plus, Image
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

const ImagesToPDF = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Invalid files",
        description: "Please select image files only",
        variant: "destructive",
      });
      return;
    }

    const newImages: ImageFile[] = imageFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages(prev => [...prev, ...newImages]);
    setPdfUrl(null);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter(img => img.id !== id);
    });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    setImages(prev => {
      const newImages = [...prev];
      const [movedImage] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedImage);
      return newImages;
    });
  };

  const convertToPDF = async () => {
    if (images.length === 0) {
      toast({
        title: "No images selected",
        description: "Please add at least one image",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const imageFile of images) {
        const arrayBuffer = await imageFile.file.arrayBuffer();
        
        let image;
        if (imageFile.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          image = await pdfDoc.embedJpg(arrayBuffer);
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      toast({
        title: "PDF Created! 🎉",
        description: `Successfully converted ${images.length} image(s) to PDF`,
      });
    } catch (error) {
      console.error('PDF conversion error:', error);
      toast({
        title: "Conversion failed",
        description: "Failed to convert images to PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadPDF = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `images-to-pdf-${Date.now()}.pdf`;
    a.click();
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setPdfUrl(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              Images to PDF
            </h1>
            <p className="text-xs text-muted-foreground">Convert images to PDF document</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card 
            className="border-2 border-dashed border-primary/30 hover:border-primary/50 cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Add Images</h3>
              <p className="text-sm text-muted-foreground">
                Click to select images (JPG, PNG, WebP)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Image List */}
        <AnimatePresence>
          {images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{images.length} Image(s)</h3>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>

              <div className="space-y-2">
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <img 
                      src={image.preview} 
                      alt={`Image ${index + 1}`}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{image.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(image.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => moveImage(index, index - 1)}
                        >
                          ↑
                        </Button>
                      )}
                      {index < images.length - 1 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => moveImage(index, index + 1)}
                        >
                          ↓
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeImage(image.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Add More Button */}
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add More Images
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Convert Button */}
        {images.length > 0 && !pdfUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button 
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              size="lg"
              onClick={convertToPDF}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5 mr-2" />
                  Convert to PDF
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {pdfUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">PDF Ready!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your PDF has been created successfully
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    size="lg"
                    onClick={downloadPDF}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={clearAll}
                  >
                    Convert More Images
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {images.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-muted/30">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">💡 Tips</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Select multiple images at once</li>
                  <li>• Drag to reorder images in the PDF</li>
                  <li>• Each image becomes one PDF page</li>
                  <li>• Supports JPG, PNG, and WebP formats</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default ImagesToPDF;
