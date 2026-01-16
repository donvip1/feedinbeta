import React, { useState, useRef } from 'react';
import { ArrowLeft, Image, Download, Type, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';

const memeTemplates = [
  { id: 'drake', name: 'Drake', url: 'https://i.imgflip.com/30b1gx.jpg' },
  { id: 'distracted', name: 'Distracted Boyfriend', url: 'https://i.imgflip.com/1ur9b0.jpg' },
  { id: 'change', name: 'Change My Mind', url: 'https://i.imgflip.com/24y43o.jpg' },
  { id: 'button', name: 'Two Buttons', url: 'https://i.imgflip.com/1g8my4.jpg' },
  { id: 'brain', name: 'Expanding Brain', url: 'https://i.imgflip.com/1jwhww.jpg' },
  { id: 'success', name: 'Success Kid', url: 'https://i.imgflip.com/1bhk.jpg' }
];

const MemeGenerator = () => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<typeof memeTemplates[0] | null>(null);
  const [topText, setTopText] = useState('');
  const [bottomText, setBottomText] = useState('');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [generatedMeme, setGeneratedMeme] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleTemplateSelect = (template: typeof memeTemplates[0]) => {
    setSelectedTemplate(template);
    setCustomImage(null);
    setGeneratedMeme(null);
  };

  const handleCustomImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCustomImage(e.target?.result as string);
        setSelectedTemplate(null);
        setGeneratedMeme(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateMeme = async () => {
    const imageUrl = customImage || selectedTemplate?.url;
    if (!imageUrl) {
      toast.error('Please select a template or upload an image');
      return;
    }

    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Configure text style
        const fontSize = Math.floor(img.width / 12);
        ctx.font = `bold ${fontSize}px Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize / 15;
        ctx.fillStyle = 'white';
        
        // Draw top text
        if (topText) {
          const topY = fontSize + 10;
          ctx.strokeText(topText.toUpperCase(), img.width / 2, topY);
          ctx.fillText(topText.toUpperCase(), img.width / 2, topY);
        }
        
        // Draw bottom text
        if (bottomText) {
          const bottomY = img.height - 20;
          ctx.strokeText(bottomText.toUpperCase(), img.width / 2, bottomY);
          ctx.fillText(bottomText.toUpperCase(), img.width / 2, bottomY);
        }
        
        const dataUrl = canvas.toDataURL('image/png');
        setGeneratedMeme(dataUrl);
        toast.success('Meme generated!');
        setIsGenerating(false);
      };

      img.onerror = () => {
        toast.error('Failed to load image. Try a different template.');
        setIsGenerating(false);
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Meme generation error:', error);
      toast.error('Failed to generate meme');
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedMeme) {
      const a = document.createElement('a');
      a.href = generatedMeme;
      a.download = 'meme.png';
      a.click();
      toast.success('Meme downloaded!');
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
            <h1 className="text-xl font-bold">Meme Generator</h1>
            <p className="text-sm text-muted-foreground">Create funny memes</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Templates */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Choose Template</h3>
          <div className="grid grid-cols-3 gap-2">
            {memeTemplates.map((template) => (
              <div
                key={template.id}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                  selectedTemplate?.id === template.id ? 'border-primary' : 'border-transparent'
                }`}
                onClick={() => handleTemplateSelect(template)}
              >
                <img 
                  src={template.url} 
                  alt={template.name}
                  className="w-full h-20 object-cover"
                />
              </div>
            ))}
          </div>
          
          <div className="mt-3">
            <label className="block text-sm text-center cursor-pointer p-3 border-2 border-dashed border-border rounded-lg hover:border-primary/50">
              Or upload your own image
              <input
                type="file"
                accept="image/*"
                onChange={handleCustomImage}
                className="hidden"
              />
            </label>
          </div>
        </Card>

        {/* Text Inputs */}
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Add Text</h3>
            </div>
            <Input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="Top text"
            />
            <Input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder="Bottom text"
            />
            <Button 
              onClick={generateMeme}
              disabled={isGenerating || (!selectedTemplate && !customImage)}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Meme'
              )}
            </Button>
          </div>
        </Card>

        {/* Preview */}
        {(selectedTemplate || customImage) && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Preview</h3>
            <img 
              src={customImage || selectedTemplate?.url} 
              alt="Preview"
              className="w-full rounded-lg"
            />
          </Card>
        )}

        {/* Generated Meme */}
        {generatedMeme && (
          <Card className="p-4">
            <div className="space-y-3">
              <h3 className="font-semibold">Your Meme</h3>
              <img 
                src={generatedMeme} 
                alt="Generated meme"
                className="w-full rounded-lg"
              />
              <Button onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download Meme
              </Button>
            </div>
          </Card>
        )}

        {/* Hidden canvas for meme generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <BottomNav />
    </div>
  );
};

export default MemeGenerator;
