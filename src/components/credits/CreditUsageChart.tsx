import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Legend } from "recharts";

export type CreditTransaction = {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  description: string | null;
};

function formatDay(ts: string) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketCategory(t: CreditTransaction): string {
  const desc = (t.description || '').toLowerCase();
  if (desc.includes('friend request')) return 'friend_requests';
  if (desc.includes('voice call') || desc.includes('video call') || desc.includes('call')) return 'calls';
  if (desc.includes('ai')) return 'ai_features';
  if (t.type === 'purchase') return 'purchases';
  if (t.type === 'refund') return 'refunds';
  if (t.type === 'bonus' || t.type === 'admin_grant') return 'bonuses';
  if (desc.includes('profile view')) return 'profile_views';
  return 'other';
}

export function CreditUsageChart({ transactions }: { transactions?: CreditTransaction[] }) {
  const daily: Record<string, any> = {};
  (transactions || []).forEach((tx) => {
    const day = formatDay(tx.created_at);
    const cat = bucketCategory(tx);
    if (!daily[day]) daily[day] = { day };
    daily[day][cat] = (daily[day][cat] || 0) + Math.abs(tx.amount);
  });
  const data = Object.values(daily).sort((a: any, b: any) => (a.day > b.day ? 1 : -1));

  const chartConfig = {
    friend_requests: { label: 'Friend Requests', color: 'hsl(var(--primary))' },
    calls: { label: 'Calls', color: 'hsl(var(--chart-2))' },
    ai_features: { label: 'AI Features', color: 'hsl(var(--chart-3))' },
    purchases: { label: 'Purchases', color: 'hsl(var(--chart-4))' },
    refunds: { label: 'Refunds', color: 'hsl(var(--chart-5))' },
    bonuses: { label: 'Bonuses', color: 'hsl(var(--chart-6, var(--primary)))' },
    profile_views: { label: 'Profile Views', color: 'hsl(var(--chart-7, var(--primary)))' },
    other: { label: 'Other', color: 'hsl(var(--muted-foreground))' },
  } as const;

  const keys = Object.keys(chartConfig) as (keyof typeof chartConfig)[];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Usage Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig as any} className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: 12, right: 12 }}>
              <defs>
                {keys.map((k) => (
                  <linearGradient id={`grad-${k}`} key={k} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={(chartConfig as any)[k].color} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={(chartConfig as any)[k].color} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="day" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              {keys.map((k) => (
                <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={(chartConfig as any)[k].color} fill={`url(#grad-${k})`} />
              ))}
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export default CreditUsageChart;
