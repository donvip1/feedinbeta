import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface CallStatsDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statsHistory: Array<{
    timestamp: number;
    latency: number;
    packetLoss: number;
    bandwidth: number;
  }>;
  currentStats: {
    latency: number;
    packetLoss: number;
    bandwidth: number;
  } | null;
}

export const CallStatsDashboard = ({ open, onOpenChange, statsHistory, currentStats }: CallStatsDashboardProps) => {
  const chartData = statsHistory.map(stat => ({
    time: format(stat.timestamp, 'HH:mm:ss'),
    latency: Math.round(stat.latency),
    packetLoss: Math.round(stat.packetLoss * 100) / 100,
    bandwidth: Math.round(stat.bandwidth / 1024), // Convert to KB
  }));

  const avgLatency = statsHistory.length > 0
    ? Math.round(statsHistory.reduce((sum, s) => sum + s.latency, 0) / statsHistory.length)
    : 0;
  const avgPacketLoss = statsHistory.length > 0
    ? Math.round((statsHistory.reduce((sum, s) => sum + s.packetLoss, 0) / statsHistory.length) * 100) / 100
    : 0;
  const avgBandwidth = statsHistory.length > 0
    ? Math.round(statsHistory.reduce((sum, s) => sum + s.bandwidth, 0) / statsHistory.length / 1024)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call Statistics</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Current Latency</div>
              <div className="text-2xl font-bold">{currentStats ? Math.round(currentStats.latency) : 0}ms</div>
              <div className="text-xs text-muted-foreground">Avg: {avgLatency}ms</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Packet Loss</div>
              <div className="text-2xl font-bold">{currentStats ? (currentStats.packetLoss).toFixed(2) : 0}%</div>
              <div className="text-xs text-muted-foreground">Avg: {avgPacketLoss}%</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground">Bandwidth</div>
              <div className="text-2xl font-bold">{currentStats ? Math.round(currentStats.bandwidth / 1024) : 0}KB</div>
              <div className="text-xs text-muted-foreground">Avg: {avgBandwidth}KB</div>
            </div>
          </div>

          {/* Latency Chart */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Latency Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="latency" stroke="hsl(var(--primary))" name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Packet Loss Chart */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Packet Loss Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="packetLoss" stroke="hsl(var(--destructive))" name="Packet Loss (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bandwidth Chart */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Bandwidth Usage Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="bandwidth" stroke="hsl(var(--accent))" name="Bandwidth (KB)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
