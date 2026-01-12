import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Star, Trash2, Edit, CheckCircle, Globe } from 'lucide-react';
import { getCountryByCode } from '@/lib/p2p-config';

interface PaymentMethodCardProps {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  countryCode: string;
  currencyCode: string;
  isDefault: boolean;
  isVerified: boolean;
  onSetDefault: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  id,
  bankName,
  accountNumber,
  accountName,
  countryCode,
  currencyCode,
  isDefault,
  isVerified,
  onSetDefault,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  const countryInfo = getCountryByCode(countryCode);
  
  // Mask account number for security
  const maskedAccount = accountNumber.length > 4 
    ? `****${accountNumber.slice(-4)}` 
    : accountNumber;

  return (
    <Card className={`relative overflow-hidden transition-all ${isDefault ? 'ring-2 ring-primary' : ''}`}>
      {isDefault && (
        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-2 py-0.5 text-xs rounded-bl">
          Default
        </div>
      )}
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{bankName}</h4>
                {isVerified && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">{accountName}</p>
              <p className="text-sm font-mono">{maskedAccount}</p>
              
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  {countryInfo?.name || countryCode}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {currencyCode}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            {!isDefault && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSetDefault(id)}
                disabled={isLoading}
                title="Set as default"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(id)}
              disabled={isLoading}
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(id)}
              disabled={isLoading}
              className="text-destructive hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
