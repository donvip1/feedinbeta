import React, { useState } from 'react';
import { ArrowLeft, Palette, Download, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { BottomNav } from '@/components/navigation/BottomNav';
import { supabase } from '@/integrations/supabase/client';

const LogoMaker = () => {
  const navigate = useNavigate();
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('modern');
  const [colorScheme, setColorScheme] = useState('blue');
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const styles = [
    { value: 'modern', label: 'Modern & Minimal' },
    { value: 'classic', label: 'Classic & Elegant' },
    { value: 'playful', label: 'Playful & Fun' },
    { value: 'tech', label: 'Tech & Futuristic' },
    { value: 'organic', label: 'Organic & Natural' },
    { value: 'bold', label: 'Bold & Strong' }
  ];

  const colors = [
    { value: 'blue', label: 'Blue / Professional' },
    { value: 'green', label: 'Green / Natural' },
    { value: 'purple', label: 'Purple / Creative' },
    { value: 'red', label: 'Red / Energetic' },
    { value: 'orange', label: 'Orange / Friendly' },
    { value: 'black', label: 'Black / Luxury' },
    { value: 'gradient', label: 'Gradient / Modern' }
  ];

  const handleGenerate = async () => {
    if (!brandName.trim()) {
      toast.error('Please enter your brand name');
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = `Create a professional logo for a brand called "${brandName}". 
        Style: ${styles.find(s => s.value === style)?.label}. 
        Color scheme: ${colors.find(c => c.value === colorScheme)?.label}. 
        ${description ? `Description: ${description}` : ''}
        The logo should be clean, memorable, and suitable for use on websites, business cards, and social media. 
        Create a simple, iconic logo design with the brand name incorporated tastefully.`;

      const { data, error } = await supabase.functions.invoke('ai-image-gen', {
        body: {
          prompt,
          width: 512,
          height: 512
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setLogoUrl(data.imageUrl);
        toast.success('Logo generated successfully!');
      } else {
        throw new Error('No logo generated');
      }
    } catch (error) {
      console.error('Logo generation error:', error);
      toast.error('Failed to generate logo. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (logoUrl) {
      const a = document.createElement('a');
      a.href = logoUrl;
      a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-logo.png`;
      a.click();
      toast.success('Logo downloaded!');
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
            <h1 className="text-xl font-bold">Logo Maker</h1>
            <p className="text-sm text-muted-foreground">AI-powered logo design</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Brand Details</h3>
            </div>

            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Your brand name"
            />

            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your brand (optional): What does your business do? What values do you want to convey?"
              className="min-h-[80px]"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Style</label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Colors</label>
                <Select value={colorScheme} onValueChange={setColorScheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !brandName.trim()}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Logo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Logo
                </>
              )}
            </Button>
          </div>
        </Card>

        {logoUrl && (
          <Card className="p-4">
            <div className="space-y-4">
              <h3 className="font-semibold">Your Logo</h3>
              <div className="bg-white p-4 rounded-lg">
                <img 
                  src={logoUrl} 
                  alt={`${brandName} logo`}
                  className="w-full max-w-xs mx-auto rounded"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={handleGenerate} variant="outline" className="flex-1">
                  Regenerate
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 bg-muted/50">
          <div className="text-sm space-y-2">
            <h4 className="font-medium">Tips for better logos:</h4>
            <ul className="text-muted-foreground space-y-1">
              <li>• Keep your brand name short and memorable</li>
              <li>• Describe your business in the description</li>
              <li>• Try different styles to find the best fit</li>
              <li>• Generate multiple versions and compare</li>
            </ul>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};

export default LogoMaker;
