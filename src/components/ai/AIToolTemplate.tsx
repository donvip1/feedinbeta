import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Download, Share2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ImageShareModal } from '@/components/shared/ImageShareModal';
import { MarkdownRenderer } from '@/components/ai/MarkdownRenderer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface AIToolTemplateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  creditCost: number;
  acceptedFileTypes?: string;
  maxFileSize?: number; // in MB
  children: React.ReactNode;
  resultUrl?: string;
  resultType?: 'image' | 'file' | 'text';
  isProcessing?: boolean;
  progress?: number;
  onBack?: () => void;
}

export const AIToolTemplate: React.FC<AIToolTemplateProps> = ({
  title,
  description,
  icon,
  creditCost,
  children,
  resultUrl,
  resultType = 'image',
  isProcessing = false,
  progress = 0,
  onBack,
}) => {
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/ai/tools');
    }
  };

  const handleDownload = async () => {
    if (!resultUrl) return;

    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedin-${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${resultType === 'image' ? 'png' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              {icon}
            </div>
            <span className="text-lg font-semibold">{title}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            ~{creditCost} credits
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Description */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardContent>
        </Card>

        {/* Processing Indicator */}
        {isProcessing && (
          <Card className="border-primary/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium">Processing...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Please wait while we process your request
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {children}

        {/* Result Actions */}
        {resultUrl && !isProcessing && (
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            {resultType === 'image' && (
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}
          </div>
        )}
      </div>

      {resultType === 'image' && (
        <ImageShareModal
          open={showShareModal}
          onOpenChange={setShowShareModal}
          imageUrl={resultUrl || ''}
          imageType="generated"
        />
      )}

      <BottomNav />
    </div>
  );
};

// File Dropzone Component
export interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  acceptedTypes?: string;
  maxSize?: number; // MB
  preview?: string;
  onClear?: () => void;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  acceptedTypes = 'image/*',
  maxSize = 10,
  preview,
  onClear,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  const validateAndSelect = (file: File) => {
    if (file.size > maxSize * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${maxSize}MB`,
        variant: 'destructive',
      });
      return;
    }
    onFileSelect(file);
  };

  if (preview) {
    return (
      <div className={cn('relative rounded-lg overflow-hidden', className)}>
        <img src={preview} alt="Preview" className="w-full rounded-lg" />
        {onClear && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute bottom-2 right-2"
            onClick={onClear}
          >
            Change File
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
        isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileChange}
        className="hidden"
      />
      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
      <p className="font-medium mb-1">Drop file here or click to upload</p>
      <p className="text-sm text-muted-foreground">
        Max size: {maxSize}MB
      </p>
    </div>
  );
};

// Result Display Component
export interface ResultDisplayProps {
  type: 'image' | 'text' | 'file';
  url?: string;
  text?: string;
  filename?: string;
  className?: string;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  type,
  url,
  text,
  filename,
  className,
}) => {
  if (type === 'image' && url) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium">Result Ready</span>
          </div>
          <img src={url} alt="Result" className="w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (type === 'text' && text) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium">Result Ready</span>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <MarkdownRenderer content={text} className="text-sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'file' && url) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium">File Ready</span>
          </div>
          <div className="flex items-center gap-3 bg-muted p-4 rounded-lg">
            <div className="p-2 bg-background rounded">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{filename || 'Download file'}</p>
              <p className="text-xs text-muted-foreground">Click download to save</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
