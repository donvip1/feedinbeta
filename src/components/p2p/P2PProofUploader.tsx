import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload, Image, FileCheck, X, Eye, Camera } from 'lucide-react';

interface P2PProofUploaderProps {
  transactionId: string;
  proofType: 'payment' | 'receipt' | 'confirmation';
  title: string;
  description: string;
  onUploadSuccess?: () => void;
}

export const P2PProofUploader = ({
  transactionId,
  proofType,
  title,
  description,
  onUploadSuccess,
}: P2PProofUploaderProps) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofDescription, setProofDescription] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast.error('Please upload an image or PDF file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File must be less than 10MB');
        return;
      }

      setSelectedFile(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setProofDescription('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');

      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `proofs/${transactionId}/${proofType}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('p2p-proofs')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('p2p-proofs')
        .getPublicUrl(filePath);

      if (proofType !== 'payment') {
        throw new Error('Only buyer payment proofs are supported.');
      }

      const { error } = await (supabase as any).rpc(
        'p2p_submit_payment_proof',
        {
          p_transaction_id: transactionId,
          p_proof_url: publicUrl,
          p_notes: proofDescription || null,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Proof uploaded successfully');
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['p2p-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['p2p-proofs', transactionId] });
      onUploadSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload proof');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Click to upload proof</p>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG, or PDF up to 10MB
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative">
              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-h-64 object-contain bg-muted"
                  />
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-10 p-2 bg-background/80 rounded-lg hover:bg-background"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Image className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={clearSelection}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Optional description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Add any notes about this proof..."
                value={proofDescription}
                onChange={(e) => setProofDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Upload button */}
            <Button
              className="w-full"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Proof'}
            </Button>
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ Make sure the image is clear and readable</p>
          <p>✓ Include transaction reference numbers if visible</p>
          <p>✓ Do not edit or alter the screenshot</p>
        </div>
      </CardContent>
    </Card>
  );
};
