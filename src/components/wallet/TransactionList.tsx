import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
}

type FilterType = 'all' | 'earned' | 'spent';

export const TransactionList: React.FC<TransactionListProps> = ({ transactions }) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'earned', label: 'Earned' },
    { id: 'spent', label: 'Spent' },
  ];

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'earned') return tx.amount > 0;
    if (filter === 'spent') return tx.amount < 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-[40px]",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "p-2 rounded-full flex-shrink-0",
                  tx.amount > 0 ? "bg-green-500/20" : "bg-red-500/20"
                )}>
                  {tx.amount > 0 ? (
                    <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
              <div className={cn(
                "font-bold text-sm flex-shrink-0 ml-3",
                tx.amount > 0 ? "text-green-500" : "text-red-500"
              )}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
};
