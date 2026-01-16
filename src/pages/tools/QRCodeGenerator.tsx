import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, QrCode, Download, Share2, Link, 
  Mail, Phone, MessageSquare, Wifi, Zap
} from 'lucide-react';

const QRCodeGenerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [qrType, setQrType] = useState<string>('url');
  const [inputValue, setInputValue] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  
  // For WiFi
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiType, setWifiType] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');

  // Simple QR code generator using canvas
  const generateQRCode = async (data: string) => {
    if (!data.trim()) return;

    // Using a simple QR code generation approach
    // In production, you'd want to use a library like 'qrcode'
    try {
      // Create QR code using Google Charts API (simple approach)
      const size = 300;
      const encodedData = encodeURIComponent(data);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}`;
      
      setQrDataUrl(qrUrl);

      // Log usage
      if (user) {
        await supabase.from('ai_tool_usage').insert({
          user_id: user.id,
          tool_id: 'qr-code',
          tool_category: 'utility',
          credits_used: 2,
          status: 'completed',
          metadata: { qr_type: qrType },
        });
      }

      toast({ title: 'QR Code generated!' });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({ title: 'Generation failed', variant: 'destructive' });
    }
  };

  const getQRData = (): string => {
    switch (qrType) {
      case 'url':
        return inputValue.startsWith('http') ? inputValue : `https://${inputValue}`;
      case 'email':
        return `mailto:${inputValue}`;
      case 'phone':
        return `tel:${inputValue}`;
      case 'sms':
        return `sms:${inputValue}`;
      case 'wifi':
        return `WIFI:T:${wifiType};S:${wifiSSID};P:${wifiPassword};;`;
      case 'text':
      default:
        return inputValue;
    }
  };

  const handleGenerate = () => {
    const data = getQRData();
    if (!data || data.length < 3) {
      toast({ title: 'Please enter valid data', variant: 'destructive' });
      return;
    }
    generateQRCode(data);
  };

  const handleDownload = async () => {
    if (!qrDataUrl) return;

    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-code-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'QR Code downloaded!' });
    } catch (error) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (!qrDataUrl) return;

    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'qr-code.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'QR Code',
        });
      } else {
        handleDownload();
      }
    } catch (error) {
      handleDownload();
    }
  };

  const qrTypes = [
    { value: 'url', label: 'URL', icon: Link },
    { value: 'text', label: 'Text', icon: MessageSquare },
    { value: 'email', label: 'Email', icon: Mail },
    { value: 'phone', label: 'Phone', icon: Phone },
    { value: 'wifi', label: 'WiFi', icon: Wifi },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-lg font-semibold">QR Code Generator</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            ~2
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* QR Type Selection */}
        <Card>
          <CardContent className="p-4">
            <Label className="mb-3 block">QR Code Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {qrTypes.map((type) => (
                <Button
                  key={type.value}
                  variant={qrType === type.value ? 'default' : 'outline'}
                  className="flex-col h-auto py-3 gap-1"
                  onClick={() => {
                    setQrType(type.value);
                    setInputValue('');
                    setQrDataUrl('');
                  }}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-xs">{type.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Input Fields */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {qrType === 'wifi' ? (
              <>
                <div className="space-y-2">
                  <Label>Network Name (SSID)</Label>
                  <Input
                    placeholder="Enter WiFi name"
                    value={wifiSSID}
                    onChange={(e) => setWifiSSID(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter WiFi password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Security Type</Label>
                  <div className="flex gap-2">
                    {(['WPA', 'WEP', 'nopass'] as const).map((type) => (
                      <Button
                        key={type}
                        variant={wifiType === type ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setWifiType(type)}
                      >
                        {type === 'nopass' ? 'None' : type}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>
                  {qrType === 'url' && 'Website URL'}
                  {qrType === 'text' && 'Text Content'}
                  {qrType === 'email' && 'Email Address'}
                  {qrType === 'phone' && 'Phone Number'}
                </Label>
                <Input
                  placeholder={
                    qrType === 'url' ? 'https://example.com' :
                    qrType === 'email' ? 'email@example.com' :
                    qrType === 'phone' ? '+1234567890' :
                    'Enter text...'
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>
            )}

            <Button 
              onClick={handleGenerate} 
              className="w-full"
              disabled={
                (qrType === 'wifi' && (!wifiSSID)) ||
                (qrType !== 'wifi' && !inputValue.trim())
              }
            >
              <QrCode className="w-4 h-4 mr-2" />
              Generate QR Code
            </Button>
          </CardContent>
        </Card>

        {/* QR Code Display */}
        {qrDataUrl && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <img 
                  src={qrDataUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Scan this code with your phone camera
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default QRCodeGenerator;
