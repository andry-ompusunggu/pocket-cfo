// MesoDashboard.tsx

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Label } from "recharts";
import { PieChart as PieChartIcon, Store } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatIDR } from '@/lib/formatters'; 

// --- Types ---
interface CategoryData {
  category: string;
  total_amount: number;
  fill?: string;
}

interface MerchantData {
  merchant: string;
  total_amount: number;
}

// Chart palette based on Neon Mint theme
const CHART_COLORS = [
  "var(--chart-1)", // Neon Mint
  "var(--chart-2)", // White
  "var(--chart-3)", // Dark Gray
  "var(--chart-4)", // Medium Gray
  "var(--chart-5)", // Dark Mint
];

// --- Minimalist & Dynamic Custom Tooltip ---
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]; 
    const data = item.payload;
    
    // Prioritize actual merchant/category data over default Recharts name
    const title = data.merchant || data.category || item.name || "Detail";
    const amount = item.value || data.total_amount || 0;
    const fillColor = item.fill || "var(--primary)";

    return (
      <div className="bg-card/95 backdrop-blur-md border border-border px-3 py-2.5 rounded-xl shadow-xl min-w-[180px] font-mono animate-in fade-in zoom-in-95 duration-200 z-50">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div 
              className="h-2.5 w-2.5 rounded-full shrink-0" 
              style={{ backgroundColor: fillColor, boxShadow: `0 0 8px ${fillColor}80` }} 
            />
            <span className="font-bold text-foreground text-xs uppercase tracking-wider truncate">
              {title}
            </span>
          </div>
          <span className="font-bold text-foreground text-xs whitespace-nowrap">
            {formatIDR(amount)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export default function MesoDashboard({ targetMonth }: { targetMonth: string }) {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [merchants, setMerchants] = useState<MerchantData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dynamicConfig, setDynamicConfig] = useState<ChartConfig>({});

  // Calculate Total Expense for the donut center
  const totalExpense = useMemo(() => {
    return categories.reduce((acc, curr) => acc + curr.total_amount, 0);
  }, [categories]);

  useEffect(() => {
    const fetchMesoData = async () => {
      setIsLoading(true);
      try {
        const startDate = `${targetMonth}-01`;
        const [year, month] = targetMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${targetMonth}-${lastDay}`;

        const [categoryRes, merchantRes] = await Promise.all([
          supabase.from('vw_expense_by_category_raw')
            .select('category, total_amount')
            .gte('transaction_timestamp', `${startDate}T00:00:00+07:00`)
            .lte('transaction_timestamp', `${endDate}T23:59:59+07:00`),
          
          supabase.from('vw_top_merchants_raw')
            .select('merchant, total_amount') 
            .gte('transaction_timestamp', `${startDate}T00:00:00+07:00`)
            .lte('transaction_timestamp', `${endDate}T23:59:59+07:00`)
        ]);

        if (categoryRes.error) throw categoryRes.error;
        if (merchantRes.error) throw merchantRes.error;

        if (categoryRes.data) {
          const aggregatedCat = categoryRes.data.reduce((acc: any, curr: any) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.total_amount;
            return acc;
          }, {});

          const formatted = Object.entries(aggregatedCat)
            .map(([category, total_amount], index) => ({
              category,
              total_amount: total_amount as number,
              fill: CHART_COLORS[index % CHART_COLORS.length]
            }))
            .sort((a, b) => b.total_amount - a.total_amount);
          
          const config = formatted.reduce((acc, curr, index) => {
            acc[curr.category] = {
              label: curr.category,
              color: CHART_COLORS[index % CHART_COLORS.length]
            };
            return acc;
          }, {} as ChartConfig);

          setDynamicConfig(config);
          setCategories(formatted);
        }
        
        if (merchantRes.data) {
          const aggregatedMerch = merchantRes.data.reduce((acc: any, curr: any) => {
            acc[curr.merchant] = (acc[curr.merchant] || 0) + curr.total_amount;
            return acc;
          }, {});

          const top10Merchants = Object.entries(aggregatedMerch)
            .map(([merchant, total_amount]) => ({
              merchant,
              total_amount: total_amount as number
            }))
            .sort((a, b) => b.total_amount - a.total_amount)
            .slice(0, 10);

          setMerchants(top10Merchants);
        }
      } catch (err) {
        console.error("Meso View Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMesoData();
  }, [targetMonth]);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground animate-pulse font-mono text-sm tracking-widest uppercase">SYNCING MESO DATA...</div>;
  }

  // Helper to compact large numbers (e.g., 4,500,000 -> 4.5M) for donut center
  const formatCompact = (num: number) => {
    if (num >= 1000000) return `Rp ${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `Rp ${(num / 1000).toFixed(0)}k`;
    return `Rp ${num}`;
  };

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-8 bg-background">
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <PieChartIcon className="text-primary" size={22} />
          Meso View
        </h2>
        <p className="text-muted-foreground text-[11px] md:text-sm">
          Expense distribution analysis for {new Date(targetMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8 px-0 md:px-0 pb-16 md:pb-0">
        
        {/* --- 1. CATEGORY DONUT CHART --- */}
        <Card className="border-border bg-card flex flex-col">
          <CardHeader className="pb-0 md:pb-2 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="text-sm md:text-xl">Expense Distribution</CardTitle>
            <CardDescription className="text-[10px] md:text-sm">Categorized spending habits</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center pb-6 md:pb-8 px-2 md:px-6">
            <ChartContainer config={dynamicConfig} className="mx-auto aspect-square max-h-[250px] md:max-h-[300px] w-full">
              <PieChart>
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                <Pie
                  data={categories}
                  dataKey="total_amount"
                  nameKey="category"
                  innerRadius={65} 
                  outerRadius={95}
                  paddingAngle={4}
                  stroke="var(--card)"
                  strokeWidth={3}
                >
                  {/* Donut Center Text */}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-xl md:text-2xl font-bold font-mono">
                              {formatCompact(totalExpense)}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-[10px] md:text-xs">
                              Total Expense
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            
            {/* Legend / Visual Metadata below Chart */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 md:mt-2 px-2">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.fill }} />
                  <span className="text-[10px] md:text-xs text-muted-foreground font-medium truncate max-w-[100px] capitalize">{cat.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* --- 2. MERCHANT BAR CHART --- */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 md:pb-6 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="flex items-center gap-2 text-foreground text-sm md:text-xl">
              <Store size={18} className="text-muted-foreground" />
              Top Merchants
            </CardTitle>
            <CardDescription className="text-[10px] md:text-sm">Highest accumulated transaction volume</CardDescription>
          </CardHeader>
          <CardContent className="px-1 md:px-6 pb-6">
            <ChartContainer config={dynamicConfig} className="h-[280px] md:h-[320px] w-full">
              <BarChart data={merchants} layout="vertical" margin={{ left: 0, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted/30" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="merchant" 
                  type="category" 
                  width={85} 
                  className="text-foreground text-[9px] md:text-xs font-semibold capitalize" 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                />
                <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.3 }} content={<CustomTooltip />} />
                <Bar 
                  dataKey="total_amount" 
                  fill="var(--chart-1)" 
                  radius={[0, 4, 4, 0]} 
                  barSize={18}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}