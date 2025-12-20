import React from 'react';
import { 
  LayoutDashboard, 
  Gift, 
  CreditCard, 
  Crown, 
  ShoppingBag, 
  History 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WalletTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'gifts', label: 'Gifts', icon: Gift },
  { id: 'buy', label: 'Buy', icon: CreditCard },
  { id: 'subscribe', label: 'Subscribe', icon: Crown },
  { id: 'marketplace', label: 'Market', icon: ShoppingBag },
  { id: 'history', label: 'History', icon: History },
];

export const WalletTabs: React.FC<WalletTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide -mx-4 px-4">
      <div className="flex gap-1 min-w-max pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap min-w-[44px] min-h-[44px]",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
