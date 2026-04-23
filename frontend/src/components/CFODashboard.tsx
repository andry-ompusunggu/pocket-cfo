import { useCFOData } from '../hooks/useCFOData';
import { Wallet, Flame, Target, AlertTriangle, TrendingDown, CheckCircle2, Crosshair } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { 
  style: 'currency', 
  currency: 'IDR', 
  minimumFractionDigits: 0,
  maximumFractionDigits: 0 
}).format(val);

export const CFODashboard = ({ userId }: { userId: string | number }) => {
  const { data, isLoading, error } = useCFOData(userId);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground animate-pulse font-mono text-sm tracking-widest uppercase">Syncing Liquidity Data...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-xl text-destructive flex items-center gap-3">
          <AlertTriangle size={20} />
          <p className="text-sm font-medium">Failed to load analytics: {error}</p>
        </div>
      </div>
    );
  }

  // Logic Status
  const isBurnRateDanger = data.projected_end_of_month_expense > data.real_disposable_income;
  const sinkingFundProgress = data.sinking_fund_target > 0 
    ? Math.min((data.sinking_fund_saved / data.sinking_fund_target) * 100, 100)
    : 0;

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-8 bg-background">
      
      {/* Header */}
      <header className="flex flex-col gap-1 px-1 md:px-0">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Crosshair className="text-primary" size={22} />
          Command Center
        </h2>
        <p className="text-muted-foreground text-[11px] md:text-sm">Real-time liquidity status and predictive metrics.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 px-0 md:px-0 pb-16 md:pb-0">
        
        {/* 1. REAL DISPOSABLE INCOME CARD */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 md:pb-4 pt-4 md:pt-6">
            <CardTitle className="flex items-center gap-2 text-foreground text-sm md:text-base">
              <Wallet size={18} className="text-muted-foreground" />
              Real Disposable Income
            </CardTitle>
            <CardDescription className="text-[10px] md:text-sm">Remaining funds after monthly obligations</CardDescription>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="space-y-2 md:space-y-3 text-xs md:text-sm mb-4 md:mb-6 pb-4 md:pb-6 border-b border-border/50">
              <div className="flex justify-between items-center text-foreground">
                <span className="text-muted-foreground">Gross Income</span>
                <span className="font-mono">{formatIDR(data.gross_income)}</span>
              </div>
              <div className="flex justify-between items-center text-destructive/90">
                <span>[-] Fixed Costs</span>
                <span className="font-mono">-{formatIDR(data.total_fixed_costs)}</span>
              </div>
              <div className="flex justify-between items-center text-amber-500/90">
                <span>[-] Sinking Fund</span>
                <span className="font-mono">-{formatIDR(data.mandatory_savings)}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wider">Safe To Spend</p>
              <p className="text-2xl md:text-3xl font-bold text-primary font-mono tracking-tight drop-shadow-sm">
                {formatIDR(data.real_disposable_income)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. BURN RATE PREDICTOR CARD */}
        <Card className="border-border bg-card relative overflow-hidden">
          {isBurnRateDanger && <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />}
          
          <CardHeader className="pb-3 md:pb-4 pt-4 md:pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground text-sm md:text-base">
                  <Flame size={18} className={isBurnRateDanger ? "text-destructive" : "text-muted-foreground"} />
                  Burn Rate Predictor
                </CardTitle>
                <CardDescription className="text-[10px] md:text-sm">Daily spending velocity</CardDescription>
              </div>
              {isBurnRateDanger ? (
                <span className="flex h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
              ) : (
                <span className="flex h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="mb-4 md:mb-6">
              <p className="text-2xl md:text-3xl font-bold text-foreground font-mono tracking-tight flex items-end gap-2">
                {formatIDR(data.daily_burn_rate)}
                <span className="text-xs font-normal text-muted-foreground mb-1 font-sans">/ day</span>
              </p>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center text-xs md:text-sm p-2.5 md:p-3 bg-secondary/50 rounded-lg border border-border/30">
                <span className="text-muted-foreground">EOM Projection</span>
                <span className={`font-mono font-bold ${isBurnRateDanger ? 'text-destructive' : 'text-foreground'}`}>
                  {formatIDR(data.projected_end_of_month_expense)}
                </span>
              </div>
              
              {isBurnRateDanger ? (
                <div className="p-2.5 md:p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex gap-2 md:gap-3 items-start">
                  <TrendingDown size={14} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-destructive uppercase">Warning:</strong> Slow down! Projection exceeds disposable income.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 md:p-3 rounded-xl border border-primary/20 bg-primary/5 flex gap-2 md:gap-3 items-start">
                  <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-primary uppercase">Optimal:</strong> Spending velocity is strictly under control.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. SINKING FUND CARD */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 md:pb-4 pt-4 md:pt-6">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground text-sm md:text-base">
                  <Target size={18} className="text-muted-foreground" />
                  Sinking Fund {data.sinking_fund_date ? new Date(data.sinking_fund_date).getFullYear() : ''}
                </CardTitle>
                <CardDescription className="text-[10px] md:text-sm">Capital accumulation target</CardDescription>
              </div>
              <span className="text-[8px] md:text-[10px] font-bold bg-primary/10 text-primary px-1.5 md:py-1 rounded border border-primary/20 uppercase tracking-wider">
                {data.sinking_fund_name}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-4 md:pb-6">
            <div className="mb-6 md:mb-8 mt-1 md:mt-2">
              <div className="flex justify-between text-[10px] md:text-sm mb-2 md:mb-3">
                <span className="text-muted-foreground font-medium uppercase tracking-tight">Progress</span>
                <span className="font-bold text-foreground font-mono">{sinkingFundProgress.toFixed(1)}%</span>
              </div>
              <div className="h-2 md:h-3 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000 ease-out"
                  style={{ width: `${sinkingFundProgress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-xs md:text-sm border-t border-border/50 pt-4 md:pt-5">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Current Balance</p>
                <p className="font-bold text-foreground font-mono">{formatIDR(data.sinking_fund_saved)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-0.5">Target Goal</p>
                <p className="font-bold text-foreground font-mono">{formatIDR(data.sinking_fund_target)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};