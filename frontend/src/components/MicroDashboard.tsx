import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PriceTrend { 
  date: string; 
  standard_name: string; 
  unit: string; 
  unit_price: number;
  chartIndex?: number; 
}

interface PriceAnomaly { 
  standard_name: string; 
  latest_merchant: string; 
  avg_historical_price: number; 
  latest_unit_price: number; 
  inflation_pct: number; 
}

// Custom formatter for Unit Price (preserving decimal sensitivity)
const formatUnitPrice = (val: number) => new Intl.NumberFormat('id-ID', { 
  style: 'currency', 
  currency: 'IDR', 
  minimumFractionDigits: 0, 
  maximumFractionDigits: 2 // Flexible: show decimals if present
}).format(val);

export default function MicroDashboard() {
  const [allTrends, setAllTrends] = useState<PriceTrend[]>([]);
  const [anomalies, setAnomalies] = useState<PriceAnomaly[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [threshold, setThreshold] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [trendRes, anomalyRes] = await Promise.all([
          supabase.from('vw_item_price_trends').select('*'),
          supabase.from('vw_price_anomalies').select('*')
        ]);

        if (trendRes.error) throw trendRes.error;
        if (anomalyRes.error) throw anomalyRes.error;

        if (trendRes.data) {
          setAllTrends(trendRes.data);
          const items = Array.from(new Set(trendRes.data.map(i => i.standard_name))) as string[];
          if (items.length > 0) setSelectedItem(items[0]);
        }
        
        if (anomalyRes.data) setAnomalies(anomalyRes.data);
      } catch (err) {
        console.error("Micro View Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTrends = allTrends
    .filter(t => t.standard_name === selectedItem)
    .map((item, idx) => ({ ...item, chartIndex: idx }));

  const currentUnit = filteredTrends[0]?.unit || 'unit';

  // --- CUSTOM TOOLTIP ---
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-2xl min-w-[180px] font-mono animate-in fade-in zoom-in-95 duration-200 z-50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 pb-1 border-b border-border/50">
            {new Date(data.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-muted-foreground text-[11px]">Price</span>
            </div>
            <span className="font-bold text-primary text-sm tracking-tight">{formatUnitPrice(data.unit_price)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center text-muted-foreground animate-pulse font-mono text-sm tracking-widest uppercase">SYNCING MICRO PRICE HISTORY...</div>;

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-8 bg-background">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 px-1 md:px-0">
        <div>
          <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="text-primary" size={22} /> Micro View
          </h2>
          <p className="text-muted-foreground text-[11px] md:text-sm">Item-specific price fluctuation analysis.</p>
        </div>
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 md:gap-2 bg-secondary/20 md:bg-transparent p-2 md:p-0 rounded-xl border border-border/50 md:border-none">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Threshold: {threshold}%</span>
          <input 
            type="range" min="1" max="50" value={threshold} 
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-28 md:w-40 accent-primary cursor-pointer h-1.5"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 px-0 md:px-0 pb-16 md:pb-0">
        <Card className="md:col-span-2 border-border bg-card overflow-hidden flex flex-col">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 md:pb-6 pt-4 md:pt-6 px-4 md:px-6">
            <div>
              <CardTitle className="text-sm md:text-xl">Price Trend Tracker</CardTitle>
              <CardDescription className="text-[10px] md:text-sm">Historical price per {currentUnit}</CardDescription>
            </div>
            <select 
              className="w-full sm:w-auto bg-secondary/30 border border-border text-[11px] md:text-xs font-semibold p-2 rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}
            >
              {Array.from(new Set(allTrends.map(t => t.standard_name))).map(item => (
                <option key={item} value={item} className="bg-background">{item}</option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="px-1 md:px-6 pb-4 md:pb-6 flex-1">
            <div className="h-[220px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredTrends} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis 
                    dataKey="chartIndex" 
                    tickFormatter={(idx) => {
                      const d = filteredTrends[idx]?.date;
                      return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                    }}
                    className="text-[9px] md:text-[10px] text-muted-foreground" 
                  />
                  <YAxis hide domain={['dataMin - (dataMin * 0.05)', 'dataMax + (dataMax * 0.05)']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="unit_price" 
                    stroke="var(--chart-1)" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: "var(--background)", stroke: "var(--chart-1)", strokeWidth: 2 }} 
                    activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "var(--foreground)", strokeWidth: 2 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-2 md:pb-6 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="text-sm md:text-xl">Anomalies & Inflation</CardTitle>
            <CardDescription className="text-[10px] md:text-sm">Price spikes above {threshold}%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 md:space-y-4 px-4 md:px-6 pb-6">
            {anomalies.filter(a => a.inflation_pct > threshold).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 md:py-12 text-center">
                <CheckCircle2 size={32} className="text-primary mb-2 opacity-20" />
                <p className="text-[11px] md:text-sm text-muted-foreground">Prices are stable.</p>
              </div>
            ) : (
              anomalies.filter(a => a.inflation_pct > threshold).map((item, idx) => (
                <div key={idx} className="p-2.5 md:p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex justify-between items-center group hover:border-destructive transition-all">
                  <div className="space-y-0.5">
                    <h4 className="text-xs md:text-sm font-bold text-foreground truncate max-w-[120px] md:max-w-none capitalize">{item.standard_name}</h4>
                    <p className="text-[9px] md:text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <AlertTriangle size={10} className="text-destructive" /> 
                      +{Math.round(item.inflation_pct)}% vs Avg
                    </p>
                  </div>
                  <div className="text-right">
                    {/* Using formatUnitPrice to ensure unit price details are preserved */}
                    <p className="text-xs md:text-sm font-black text-destructive font-mono">{formatUnitPrice(item.latest_unit_price)}</p>
                    <p className="text-[8px] md:text-[9px] text-muted-foreground">at {item.latest_merchant}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}