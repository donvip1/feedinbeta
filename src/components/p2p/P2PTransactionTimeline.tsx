import { CheckCircle, Circle, Clock, AlertTriangle, XCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface TimelineStep {
  key: string;
  label: string;
  description: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'pending' | 'error';
}

interface P2PTransactionTimelineProps {
  transaction: {
    status: string;
    created_at: string;
    proof_url?: string;
    buyer_confirmed_at?: string;
    seller_confirmed_at?: string;
    dispute_id?: string;
  };
  isBuyer: boolean;
}

export const P2PTransactionTimeline = ({ transaction, isBuyer }: P2PTransactionTimelineProps) => {
  const getSteps = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        key: 'created',
        label: 'Transaction Created',
        description: 'Credits locked in escrow',
        timestamp: transaction.created_at,
        status: 'completed',
      },
      {
        key: 'payment',
        label: isBuyer ? 'Make Payment' : 'Waiting for Payment',
        description: isBuyer 
          ? 'Pay the seller and upload proof' 
          : 'Buyer makes payment and uploads proof',
        status: transaction.status === 'pending' ? 'current' : 
                ['proof_submitted', 'completed', 'disputed'].includes(transaction.status) ? 'completed' : 'pending',
      },
      {
        key: 'proof',
        label: 'Proof Submitted',
        description: 'Payment proof uploaded for verification',
        status: transaction.status === 'proof_submitted' ? 'current' :
                ['completed'].includes(transaction.status) ? 'completed' : 'pending',
      },
      {
        key: 'confirmation',
        label: isBuyer ? 'Seller Confirms' : 'Confirm Receipt',
        description: isBuyer 
          ? 'Seller verifies payment and releases credits' 
          : 'Verify payment and release credits',
        timestamp: transaction.seller_confirmed_at,
        status: transaction.status === 'completed' ? 'completed' : 'pending',
      },
      {
        key: 'completed',
        label: 'Transaction Complete',
        description: 'Credits transferred to buyer',
        status: transaction.status === 'completed' ? 'completed' : 'pending',
      },
    ];

    // Add dispute step if there's a dispute
    if (transaction.dispute_id || transaction.status === 'disputed') {
      const disputeIndex = steps.findIndex(s => s.status === 'current' || s.status === 'pending');
      steps.splice(disputeIndex > 0 ? disputeIndex : 2, 0, {
        key: 'dispute',
        label: 'Dispute Opened',
        description: 'Transaction under moderator review',
        status: 'error',
      });
    }

    // Mark cancelled transactions
    if (transaction.status === 'cancelled') {
      const currentIndex = steps.findIndex(s => s.status !== 'completed');
      if (currentIndex > 0) {
        steps[currentIndex] = {
          ...steps[currentIndex],
          label: 'Transaction Cancelled',
          description: 'Credits refunded to seller',
          status: 'error',
        };
        // Remove remaining steps
        steps.splice(currentIndex + 1);
      }
    }

    return steps;
  };

  const getStepIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'current':
        return <Clock className="w-5 h-5 text-primary animate-pulse" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const steps = getSteps();

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <div key={step.key} className="flex gap-4">
          {/* Timeline line and icon */}
          <div className="flex flex-col items-center">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full
              ${step.status === 'completed' ? 'bg-green-500/10' : 
                step.status === 'current' ? 'bg-primary/10' :
                step.status === 'error' ? 'bg-destructive/10' : 'bg-muted'}
            `}>
              {getStepIcon(step.status)}
            </div>
            {index < steps.length - 1 && (
              <div className={`
                w-0.5 h-12
                ${step.status === 'completed' ? 'bg-green-500/30' : 'bg-border'}
              `} />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-8">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${
                step.status === 'pending' ? 'text-muted-foreground' : ''
              }`}>
                {step.label}
              </h4>
              {step.key === 'dispute' && (
                <Shield className="w-4 h-4 text-destructive" />
              )}
            </div>
            <p className={`text-sm ${
              step.status === 'pending' ? 'text-muted-foreground/60' : 'text-muted-foreground'
            }`}>
              {step.description}
            </p>
            {step.timestamp && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(step.timestamp), 'PPp')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
