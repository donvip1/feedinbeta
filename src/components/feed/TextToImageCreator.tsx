import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface TextToImageCreatorProps {
  open: boolean;
  onClose: () => void;
  onCreate: (file: File) => void;
}

const BACKGROUNDS = [
  { id: 'gradient1', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient3', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'gradient4', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'gradient5', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'solid1', value: '#1a1a1a' },
  { id: 'solid2', value: '#ffffff' },
  { id: 'solid3', value: '#ff6b6b' },
];

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Impact', 'Comic Sans MS'];

export function TextToImageCreator({ open, onClose, onCreate }: TextToImageCreatorProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0].value);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState(FONTS[0]);
  const [textColor, setTextColor] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    renderCanvas();
  }, [text, background, fontSize, fontFamily, textColor]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1080;
    canvas.height = 1080;

    // Draw background
    if (background.startsWith('linear-gradient')) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      // Parse gradient colors (simplified)
      const colors = background.match(/#[0-9a-f]{6}/gi) || ['#667eea', '#764ba2'];
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = background;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap
    const maxWidth = canvas.width - 100;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word + ' ';
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);

    // Draw lines
    const lineHeight = fontSize * 1.2;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
    });
  };

  const handleCreate = () => {
    if (!text.trim()) {
      toast({
        title: 'Enter some text',
        description: 'Please enter text to create an image',
        variant: 'destructive',
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `text-image-${Date.now()}.png`, { type: 'image/png' });
        onCreate(file);
        onClose();
      }
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Image from Text</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full" />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Your Text</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share your thoughts or questions to spark discussions"
                rows={4}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">{text.length}/200</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Background</label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUNDS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setBackground(bg.value)}
                    className={`w-full aspect-square rounded-lg border-2 ${
                      background === bg.value ? 'border-primary' : 'border-transparent'
                    }`}
                    style={{ background: bg.value }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Font Size: {fontSize}px</label>
              <Slider
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0])}
                min={24}
                max={120}
                step={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Font</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full p-2 rounded-lg border bg-background"
              >
                {FONTS.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Text Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-1 p-2 rounded-lg border bg-background"
                />
              </div>
            </div>

            <Button onClick={handleCreate} className="w-full bg-gradient-primary">
              Create Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
