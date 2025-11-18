import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, AlignLeft, AlignCenter, AlignRight, Palette } from 'lucide-react';

interface TextFormattingToolProps {
  text: string;
  onTextChange: (text: string) => void;
  font: string;
  onFontChange: (font: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  alignment: 'left' | 'center' | 'right';
  onAlignmentChange: (alignment: 'left' | 'center' | 'right') => void;
}

const FONTS = [
  { name: 'Sans', value: 'font-sans' },
  { name: 'Serif', value: 'font-serif' },
  { name: 'Mono', value: 'font-mono' },
  { name: 'Bold', value: 'font-bold' },
  { name: 'Italic', value: 'italic' },
  { name: 'Handwriting', value: 'font-handwriting' },
  { name: 'Display', value: 'font-display' },
];

const COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
];

export function TextFormattingTool({
  text,
  onTextChange,
  font,
  onFontChange,
  color,
  onColorChange,
  alignment,
  onAlignmentChange,
}: TextFormattingToolProps) {
  return (
    <div className="space-y-4 p-4 bg-background/95 backdrop-blur rounded-lg">
      <div>
        <Label>Text</Label>
        <Input
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Enter text..."
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Font</Label>
          <Select value={font} onValueChange={onFontChange}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Color</Label>
          <Select value={color} onValueChange={onColorChange}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLORS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: c.value }}
                    />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Alignment</Label>
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant={alignment === 'left' ? 'default' : 'outline'}
            onClick={() => onAlignmentChange('left')}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={alignment === 'center' ? 'default' : 'outline'}
            onClick={() => onAlignmentChange('center')}
          >
            <AlignCenter className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={alignment === 'right' ? 'default' : 'outline'}
            onClick={() => onAlignmentChange('right')}
          >
            <AlignRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
