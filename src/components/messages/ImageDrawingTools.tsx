import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { 
  Pencil, 
  Square, 
  Circle, 
  Type, 
  Smile, 
  Undo, 
  Redo, 
  X, 
  Check,
  Palette
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ImageDrawingToolsProps {
  open: boolean;
  onClose: () => void;
  imageFile: File;
  onSave: (blob: Blob) => void;
}

type DrawingTool = 'pen' | 'square' | 'circle' | 'text' | 'emoji';

const COLORS = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'
];

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '✨'];

export const ImageDrawingTools = ({ open, onClose, imageFile, onSave }: ImageDrawingToolsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState('#ff0000');
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [text, setText] = useState('');
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageFile && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        saveToHistory();
      };
      img.src = URL.createObjectURL(imageFile);

      return () => URL.revokeObjectURL(img.src);
    }
  }, [imageFile]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        ctx.putImageData(history[historyStep - 1], 0, 0);
      }
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        ctx.putImageData(history[historyStep + 1], 0, 0);
      }
    }
  };

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    setIsDrawing(true);

    if (tool === 'pen') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (tool === 'text') {
      setTextPosition({ x, y });
    }
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || tool !== 'pen') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const { x, y } = getCoordinates(e);

    if (tool === 'square') {
      const startX = x - 50;
      const startY = y - 50;
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.strokeRect(startX, startY, 100, 100);
    } else if (tool === 'circle') {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.stroke();
    }

    setIsDrawing(false);
    saveToHistory();
  };

  const addText = () => {
    if (!text || !textPosition) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.font = `${brushSize * 8}px Arial`;
    ctx.fillStyle = color;
    ctx.fillText(text, textPosition.x, textPosition.y);

    setText('');
    setTextPosition(null);
    saveToHistory();
  };

  const addEmoji = (emoji: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.font = `${brushSize * 10}px Arial`;
    ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);
    setShowEmojiPicker(false);
    saveToHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob);
        toast({ title: 'Drawing saved' });
      }
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="h-screen w-screen max-w-none m-0 p-0 bg-black border-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 text-white shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={historyStep <= 0}
              className="text-white hover:bg-white/10"
            >
              <Undo className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={historyStep >= history.length - 1}
              className="text-white hover:bg-white/10"
            >
              <Redo className="w-5 h-5" />
            </Button>
          </div>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Check className="w-4 h-4 mr-2" />
            Done
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-4 min-h-0">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Text Input */}
        {textPosition && (
          <div className="absolute inset-x-0 bottom-32 px-4">
            <div className="bg-background rounded-lg p-4 space-y-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text..."
                className="w-full bg-transparent border-b border-border outline-none text-lg"
                autoFocus
              />
              <Button onClick={addText} className="w-full">
                Add Text
              </Button>
            </div>
          </div>
        )}

        {/* Color Picker */}
        {showColorPicker && (
          <div className="absolute inset-x-0 bottom-32 px-4">
            <div className="bg-background rounded-lg p-4">
              <div className="grid grid-cols-5 gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    className="w-12 h-12 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute inset-x-0 bottom-32 px-4">
            <div className="bg-background rounded-lg p-4">
              <div className="grid grid-cols-5 gap-3">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className="text-4xl hover:bg-accent rounded-lg p-2"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tools */}
        <div className="bg-background/95 backdrop-blur p-4 space-y-4 border-t border-border shrink-0">
          {/* Tool Selection */}
          <div className="flex gap-2 justify-center">
            <Button
              variant={tool === 'pen' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('pen')}
            >
              <Pencil className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'square' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('square')}
            >
              <Square className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'circle' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('circle')}
            >
              <Circle className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'text' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('text')}
            >
              <Type className="w-5 h-5" />
            </Button>
            <Button
              variant={tool === 'emoji' ? 'default' : 'outline'}
              size="icon"
              onClick={() => {
                setTool('emoji');
                setShowEmojiPicker(!showEmojiPicker);
              }}
            >
              <Smile className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <Palette className="w-5 h-5" style={{ color }} />
            </Button>
          </div>

          {/* Brush Size */}
          <div>
            <label className="text-xs mb-2 block font-medium">
              Brush Size: {brushSize}px
            </label>
            <Slider
              value={[brushSize]}
              onValueChange={([v]) => setBrushSize(v)}
              min={1}
              max={20}
              step={1}
              className="touch-none"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
