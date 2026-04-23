// MacroDashboard.tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bar, CartesianGrid, XAxis, Line, ComposedChart } from "recharts";
import { Wallet, AlertCircle, CheckCircle2, LayoutDashboard, SearchX } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// --- Types ---
interface CashflowData {
  month: string;
  total_income: number;
  total_expense: number;
  net_surplus: number;
}

interface BudgetData {
  category: string;
  budget_limit: number;
  current_spending: number;
  percentage_used: number;
}

const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { 
  style: 'currency', 
  currency: 'IDR', 
  minimumFractionDigits: 0,
  maximumFractionDigits: 0 
}).format(val);

// Accepts targetMonth prop from App.tsx (format: YYYY-MM)
export default function MacroDashboard({ targetMonth }: { targetMonth: string }) {
  const [cashflow, setCashflow] = useState<CashflowData[]>([]);
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const startDate = `${targetMonth}-01`;
        const [year, month] = targetMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${targetMonth}-${lastDay}`;

        const [cashflowRes, budgetsRes] = await Promise.all([
          supabase.from('vw_monthly_cashflow').select('*').order('month', { ascending: true }).limit(6),
          
          supabase.from('vw_budget_pacing_raw')
            .select('category, budget_limit, total_amount')
            .gte('transaction_timestamp', `${startDate}T00:00:00+07:00`)
            .lte('transaction_timestamp', `${endDate}T23:59:59+07:00`)
        ]);

        if (cashflowRes.error) throw cashflowRes.error;
        if (budgetsRes.error) throw budgetsRes.error;

        if (cashflowRes.data) setCashflow(cashflowRes.data);
        
        if (budgetsRes.data) {
          const aggregated = budgetsRes.data.reduce((acc: any, curr: any) => {
            if (!acc[curr.category]) {
              acc[curr.category] = { 
                category: curr.category, 
                budget_limit: curr.budget_limit, 
                current_spending: 0 
              };
            }
            acc[curr.category].current_spending += (curr.total_amount || 0);
            return acc;
          }, {});

          const finalBudgets = Object.values(aggregated).map((b: any) => ({
            ...b,
            percentage_used: Math.round((b.current_spending / b.budget_limit) * 100)
          }));
          
          setBudgets(finalBudgets);
        }
      } catch (err) {
        console.error("Macro View Fetch Error:", err);
        // Error is masked; UI handles empty data (budgets.length === 0)
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [targetMonth]);

  const selectedMonthData = cashflow.find(c => c.month === `${targetMonth}-01`);
  const displaySurplus = selectedMonthData ? selectedMonthData.net_surplus : 0;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground animate-pulse font-mono text-sm tracking-widest uppercase">Syncing Historical Data...</div>;
  }

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-8 bg-background">
      
      <header className="relative flex flex-col gap-1 px-1 md:px-0">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <LayoutDashboard className="text-primary" size={22} />
          Macro View
        </h2>
        
        <p className="text-muted-foreground text-[11px] md:text-sm w-full md:w-2/3">
          Financial status for {new Date(targetMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
        
        {/* SURPLUS BADGE */}
        <div className="mt-3 md:mt-0 md:absolute md:top-0 md:right-0 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 md:gap-1 p-2.5 md:p-3 rounded-xl border border-border bg-card shadow-sm md:min-w-[200px]">
          <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">Net Surplus</span>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Wallet size={14} className={displaySurplus >= 0 ? 'text-primary' : 'text-destructive'} />
            <span className={`text-base md:text-xl font-bold font-mono tracking-tight ${displaySurplus >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatIDR(displaySurplus)}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 px-0 md:px-0 pb-16 md:pb-0">
        
        {/* 1. Cashflow Trends */}
        <Card className="md:col-span-2 border-border flex flex-col bg-card overflow-hidden">
          <CardHeader className="pb-2 md:pb-6 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="text-sm md:text-xl">Cashflow Trends</CardTitle>
            <CardDescription className="text-[10px] md:text-sm">6-month historical overview</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4 md:pb-6 px-1 md:px-6">
            <ChartContainer config={{ 
              total_income: { label: "Income", color: "var(--chart-1)" },
              total_expense: { label: "Expense", color: "#ef4444" }, 
              net_surplus: { label: "Surplus", color: "var(--chart-2)" }
            }} className="h-[220px] md:h-[300px] w-full">
              <ComposedChart data={cashflow}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/30" />
                {/* Month format adjusted for universal English short name */}
                <XAxis dataKey="month" tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short' })} className="text-[9px] md:text-[10px] text-muted-foreground" />
                <ChartTooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                  content={
                    <ChartTooltipContent 
                      className="min-w-[200px] font-mono"
                      indicator="dot"
                      formatter={(value, name, item) => (
                        <div className="flex w-full items-center justify-between gap-8">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground capitalize">
                              {name ? name.toString().replace('_', ' ') : ''}
                            </span>
                          </div>
                          <span className="font-bold text-foreground">{formatIDR(value as number)}</span>
                        </div>
                      )}
                    />
                  } 
                />
                <Bar dataKey="total_income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="total_expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="net_surplus" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3, fill: "var(--card)" }} />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* 2. Budget Pacing */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2 md:pb-6 pt-4 md:pt-6 px-4 md:px-6">
            <CardTitle className="text-sm md:text-xl">Budget Pacing</CardTitle>
            <CardDescription className="text-[10px] md:text-sm">Current period budget limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-6 pb-6 px-4 md:px-6">
            {budgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 md:py-12 text-center">
                <SearchX size={32} className="text-muted-foreground mb-2 opacity-20" />
                <p className="text-[11px] md:text-sm text-muted-foreground">Budget data not found.</p>
              </div>
            ) : (
              budgets.map((budget, idx) => (
                <div key={idx} className="space-y-1.5 md:space-y-2">
                  <div className="flex justify-between items-center text-xs md:text-sm font-bold text-foreground">
                    <span className="flex items-center gap-1.5 md:gap-2">
                      {budget.category}
                      {budget.percentage_used > 100 ? <AlertCircle size={12} className="text-destructive" /> : <CheckCircle2 size={12} className="text-primary" />}
                    </span>
                    <span className={`font-mono text-[11px] md:text-sm ${budget.percentage_used > 100 ? 'text-destructive' : 'text-foreground'}`}>{budget.percentage_used}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1 md:h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 ${budget.percentage_used > 100 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(budget.percentage_used, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] md:text-[10px] text-muted-foreground font-mono font-medium">
                    <span>{formatIDR(budget.current_spending)}</span>
                    <span>{formatIDR(budget.budget_limit)}</span>
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