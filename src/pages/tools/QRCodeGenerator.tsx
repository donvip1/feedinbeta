import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/navigation/BottomNav';
import { 
  ArrowLeft, QrCode, Download, Share2, Link, 
  Mail, Phone, MessageSquare, Wifi, Sparkles, Check, Loader2, Zap
} from 'lucide-react';
import { useAIToolCredits } from '@/hooks/useAIToolCredits';

const CREDIT_COST = 5;

const QR_TYPES = [
  { value: 'url', label: 'URL', icon: Link, color: 'from-blue-500 to-cyan-500' },
  { value: 'text', label: 'Text', icon: MessageSquare, color: 'from-purple-500 to-pink-500' },
  { value: 'email', label: 'Email', icon: Mail, color: 'from-orange-500 to-red-500' },
  { value: 'phone', label: 'Phone', icon: Phone, color: 'from-green-500 to-emerald-500' },
  { value: 'wifi', label: 'WiFi', icon: Wifi, color: 'from-indigo-500 to-purple-500' },
];

const QRCodeGenerator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { balance, hasEnoughCredits, checkAndDeductCredits } = useAIToolCredits({
    toolName: 'qr_code_generator',
    creditCost: CREDIT_COST,
  });
  
  const [qrType, setQrType] = useState<string>('url');
  const [inputValue, setInputValue] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // WiFi fields
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiType, setWifiType] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');

  const generateQRCode = async (data: string) => {
    if (!data.trim()) return;

    setIsGenerating(true);
    try {
      const size = 400;
      const encodedData = encodeURIComponent(data);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&color=000000&bgcolor=FFFFFF&margin=20`;
      
      // Preload image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = qrUrl;
      });

      setQrDataUrl(qrUrl);

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
    } finally {
      setIsGenerating(false);
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

  const handleGenerate = async () => {
    const data = getQRData();
    if (!data || data.length < 3) {
      toast({ title: 'Please enter valid data', variant: 'destructive' });
      return;
    }

    const success = await checkAndDeductCredits();
    if (!success) return;

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
      a.download = `qr-code-${qrType}-${Date.now()}.png`;
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

  const currentType = QR_TYPES.find(t => t.value === qrType);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai/tools')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              QR Code Generator
            </h1>
            <p className="text-xs text-muted-foreground">Create scannable QR codes</p>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span>{CREDIT_COST}</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* QR Type Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="p-4">
              <Label className="mb-3 block font-medium">QR Code Type</Label>
              <div className="grid grid-cols-5 gap-2">
                {QR_TYPES.map((type) => (
                  <motion.button
                    key={type.value}
                    onClick={() => {
                      setQrType(type.value);
                      setInputValue('');
                      setQrDataUrl('');
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                      qrType === type.value 
                        ? `bg-gradient-to-br ${type.color} text-white shadow-lg` 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <type.icon className="w-5 h-5 mb-1" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Input Fields */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <div className={`h-1 bg-gradient-to-r ${currentType?.color || 'from-primary to-purple-500'}`} />
            <CardContent className="p-4 space-y-4">
              <AnimatePresence mode="wait">
                {qrType === 'wifi' ? (
                  <motion.div
                    key="wifi"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>Network Name (SSID)</Label>
                      <Input
                        placeholder="Enter WiFi name"
                        value={wifiSSID}
                        onChange={(e) => setWifiSSID(e.target.value)}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter WiFi password"
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        className="h-12"
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
                            className="flex-1"
                          >
                            {type === 'nopass' ? 'None' : type}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="other"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-2"
                  >
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
                      className="h-12 text-base"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Button 
                onClick={handleGenerate} 
                className="w-full h-12 text-base"
                disabled={
                  isGenerating ||
                  (qrType === 'wifi' && (!wifiSSID)) ||
                  (qrType !== 'wifi' && !inputValue.trim())
                }
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* QR Code Display */}
        <AnimatePresence>
          {qrDataUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-6 text-center">
                  <motion.div 
                    className="bg-white p-6 rounded-2xl inline-block shadow-lg mb-4"
                    initial={{ rotate: -5 }}
                    animate={{ rotate: 0 }}
                    transition={{ type: 'spring' }}
                  >
                    <img 
                      src={qrDataUrl} 
                      alt="QR Code" 
                      className="w-64 h-64 mx-auto"
                    />
                  </motion.div>
                  <div className="flex items-center justify-center gap-2 mb-4 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    Ready to scan
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleDownload} className="flex-1 max-w-32">
                      <Download className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={handleShare} className="flex-1 max-w-32">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tips Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-2">Quick Tips</h4>
                  <ul className="text-xs text-muted-foreground space-y-1.5">
                    <li>• QR codes work best with short URLs</li>
                    <li>• WiFi QR codes let guests connect instantly</li>
                    <li>• Test your QR code before sharing</li>
                    <li>• White background ensures best scanning</li>
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

export default QRCodeGenerator;