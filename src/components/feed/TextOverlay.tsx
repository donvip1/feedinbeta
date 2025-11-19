import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, Type, Palette } from 'lucide-react';

interface TextOverlayProps {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  hasOutline: boolean;
  onUpdate: (updates: Partial<TextOverlayData>) => void;
  onRemove: () => void;
  containerWidth: number;
  containerHeight: number;
}

export interface TextOverlayData {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  backgroundColor: string;
  hasOutline: boolean;
}

const COLORS = ['#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF88DC', '#6C5CE7'];
const BG_COLORS = ['transparent', '#FFFFFF80', '#00000080', '#FF6B6B80', '#4ECDC480', '#FFE66D80'];

export function TextOverlay({
  text,
  x,
  y,
  fontSize,
  color,
  backgroundColor,
  hasOutline,
  onUpdate,
  onRemove,
  containerWidth,
  containerHeight,
}: TextOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - x,
      y: touch.clientY - y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    const touch = e.touches[0];
    const newX = Math.max(0, Math.min(containerWidth - 100, touch.clientX - dragStart.x));
    const newY = Math.max(0, Math.min(containerHeight - 50, touch.clientY - dragStart.y));
    onUpdate({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - x,
      y: e.clientY - y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(containerWidth - 100, e.clientX - dragStart.x));
    const newY = Math.max(0, Math.min(containerHeight - 50, e.clientY - dragStart.y));
    onUpdate({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const textStyle = {
    fontSize: `${fontSize}px`,
    color: color,
    backgroundColor: backgroundColor,
    padding: backgroundColor !== 'transparent' ? '4px 8px' : '0',
    borderRadius: backgroundColor !== 'transparent' ? '4px' : '0',
    textShadow: hasOutline ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
    WebkitTextStroke: hasOutline ? '1px rgba(0,0,0,0.5)' : 'none',
  };

  return (
    <>
      <div
        ref={textRef}
        className="absolute cursor-move select-none font-bold whitespace-nowrap"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          ...textStyle,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={() => setShowControls(!showControls)}
      >
        {text}
      </div>

      {showControls && (
        <div className="absolute bottom-20 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Type className="w-4 h-4" />
                Size: {fontSize}px
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Slider
              value={[fontSize]}
              onValueChange={(v) => onUpdate({ fontSize: v[0] })}
              min={16}
              max={72}
              step={2}
            />
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Text Color
            </label>
            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="w-10 h-10 rounded-full border-2"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'hsl(var(--primary))' : 'transparent',
                  }}
                  onClick={() => onUpdate({ color: c })}
                />
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Text Background</label>
            <div className="grid grid-cols-6 gap-2">
              {BG_COLORS.map((bg) => (
                <button
                  key={bg}
                  className="w-10 h-10 rounded-lg border-2"
                  style={{
                    backgroundColor: bg === 'transparent' ? 'transparent' : bg,
                    borderColor: backgroundColor === bg ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                    backgroundImage: bg === 'transparent' 
                      ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)'
                      : 'none',
                    backgroundSize: bg === 'transparent' ? '10px 10px' : 'auto',
                    backgroundPosition: bg === 'transparent' ? '0 0, 5px 5px' : '0 0',
                  }}
                  onClick={() => onUpdate({ backgroundColor: bg })}
                />
              ))}
            </div>
          </div>

          {/* Text Outline */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Text Outline</label>
            <Button
              variant={hasOutline ? 'default' : 'outline'}
              size="sm"
              onClick={() => onUpdate({ hasOutline: !hasOutline })}
            >
              {hasOutline ? 'On' : 'Off'}
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setShowControls(false)}
          >
            Done
          </Button>
        </div>
      )}
    </>
  );
}
