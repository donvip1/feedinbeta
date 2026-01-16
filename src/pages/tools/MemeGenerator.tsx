import { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Image, Download, Type, Loader2, Share2, Sparkles, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';

const memeTemplates = [
  { id: 'drake', name: 'Drake', url: 'https://i.imgflip.com/30b1gx.jpg', category: 'Reactions' },
  { id: 'distracted', name: 'Distracted BF', url: 'https://i.imgflip.com/1ur9b0.jpg', category: 'Reactions' },
  { id: 'change', name: 'Change My Mind', url: 'https://i.imgflip.com/24y43o.jpg', category: 'Text' },
  { id: 'button', name: 'Two Buttons', url: 'https://i.imgflip.com/1g8my4.jpg', category: 'Decisions' },
  { id: 'brain', name: 'Expanding Brain', url: 'https://i.imgflip.com/1jwhww.jpg', category: 'Levels' },
  { id: 'success', name: 'Success Kid', url: 'https://i.imgflip.com/1bhk.jpg', category: 'Success' },
  { id: 'disaster', name: 'Disaster Girl', url: 'https://i.imgflip.com/23ls.jpg', category: 'Evil' },
  { id: 'doge', name: 'Doge', url: 'https://i.imgflip.com/4t0m5.jpg', category: 'Classic' },
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

  const handleCustomImage = (e: ChangeEvent<HTMLInputElement>) => {
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
        
        ctx.drawImage(img, 0, 0);
        
        const fontSize = Math.floor(img.width / 10);
        ctx.font = `bold ${fontSize}px Impact, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize / 12;
        ctx.fillStyle = 'white';
        
        // Draw top text with word wrap
        if (topText) {
          const topY = fontSize + 20;
          ctx.strokeText(topText.toUpperCase(), img.width / 2, topY);
          ctx.fillText(topText.toUpperCase(), img.width / 2, topY);
        }
        
        // Draw bottom text
        if (bottomText) {
          const bottomY = img.height - 30;
          ctx.strokeText(bottomText.toUpperCase(), img.width / 2, bottomY);
          ctx.fillText(bottomText.toUpperCase(), img.width / 2, bottomY);
        }
        
        const dataUrl = canvas.toDataURL('image/png');
        setGeneratedMeme(dataUrl);
        toast.success('Meme created! 🎉');
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
      a.download = `meme-${Date.now()}.png`;
      a.click();
      toast.success('Meme downloaded!');
    }
  };

  const handleShare = async () => {
    if (!generatedMeme) return;
    
    try {
      const response = await fetch(generatedMeme);
      const blob = await response.blob();
      const file = new File([blob], 'meme.png', { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Check out my meme!' });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              Meme Generator
            </h1>
            <p className="text-sm text-muted-foreground">Create hilarious memes</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Templates Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="font-semibold">Choose Template</Label>
                <span className="text-xs text-muted-foreground">{memeTemplates.length} templates</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {memeTemplates.map((template) => (
                  <motion.div
                    key={template.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedTemplate?.id === template.id 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-transparent hover:border-primary/50'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <img 
                      src={template.url} 
                      alt={template.name}
                      className="w-full aspect-square object-cover"
                    />
                    {selectedTemplate?.id === template.id && (
                      <motion.div 
                        className="absolute inset-0 bg-primary/20 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
              
              {/* Custom Upload */}
              <div className="mt-4">
                <label className="block text-center cursor-pointer p-4 border-2 border-dashed border-border rounded-lg hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Or upload your own image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomImage}
                    className="hidden"
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Text Inputs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-4">
              <div className="flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                <Label className="font-semibold">Add Your Text</Label>
              </div>
            </div>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Top Text</Label>
                <Input
                  value={topText}
                  onChange={(e) => setTopText(e.target.value)}
                  placeholder="When you..."
                  className="h-12 text-base uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Bottom Text</Label>
                <Input
                  value={bottomText}
                  onChange={(e) => setBottomText(e.target.value)}
                  placeholder="And then..."
                  className="h-12 text-base uppercase"
                />
              </div>
              <Button 
                onClick={generateMeme}
                disabled={isGenerating || (!selectedTemplate && !customImage)}
                className="w-full h-12 text-base"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Creating Magic...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate Meme
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preview */}
        <AnimatePresence>
          {(selectedTemplate || customImage) && !generatedMeme && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card>
                <CardContent className="p-4">
                  <Label className="font-semibold mb-3 block">Preview</Label>
                  <img 
                    src={customImage || selectedTemplate?.url} 
                    alt="Preview"
                    className="w-full rounded-lg"
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated Meme */}
        <AnimatePresence>
          {generatedMeme && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="overflow-hidden border-green-500/50">
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-3">
                  <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Your Meme is Ready!
                  </span>
                </div>
                <CardContent className="p-4 space-y-4">
                  <img 
                    src={generatedMeme} 
                    alt="Generated meme"
                    className="w-full rounded-lg shadow-lg"
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleDownload} className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button onClick={handleShare} variant="outline" className="flex-1">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <h4 className="font-medium text-sm mb-2">Meme Tips</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Keep text short and punchy</li>
                    <li>• Contrast makes text readable</li>
                    <li>• All caps is the meme tradition</li>
                    <li>• Timing and relatability = viral</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default MemeGenerator;