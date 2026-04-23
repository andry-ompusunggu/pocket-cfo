import { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

import { 
  Calendar, LayoutDashboard, PieChart, TrendingUp, FileText, 
  PackageSearch, WalletMinimal, Crosshair, LogOut, HelpCircle, Send,
  MoreVertical, Sun, Moon, Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

// Import all views
import MacroDashboard from "@/components/MacroDashboard";
import MesoDashboard from "@/components/MesoDashboard";
import MicroDashboard from "@/components/MicroDashboard";
import TransactionLedger from "@/components/TransactionLedger";
import ItemExplorer from "@/components/ItemExplorer";
import { CFODashboard } from "@/components/CFODashboard"; 
import Login from "@/components/Login";
import { ModeToggle } from "@/components/ModeToggle";
import { useTheme } from "@/components/theme-provider";

// --- Time Machine Helper Functions ---
const getCurrentMonthRaw = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const generateMonthOptions = () => {
  const options = [];
  const d = new Date();
  // Show 24 months history for easier period navigation
  for (let i = 0; i < 24; i++) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value: `${year}-${month}`, label });
    d.setMonth(d.getMonth() - 1); 
  }
  return options;
};

const MONTH_OPTIONS = generateMonthOptions();

// --- LATEST UNIFIED NAVIGATION COMPONENT ---
function AppNavigation({ currentPath, showTimeMachine, selectedMonth, setSelectedMonth, setIsHelpOpen, handleLogout }: any) {
  return (
    <>
      {/* --- DESKTOP UNIFIED COMMAND BAR --- */}
      <nav className="hidden md:flex fixed top-4 lg:top-6 left-1/2 -translate-x-1/2 z-50 items-center px-2.5 lg:px-4 py-1.5 lg:py-2 bg-card/70 backdrop-blur-xl border border-border/60 rounded-full shadow-2xl transition-all duration-500 ease-in-out w-max max-w-[98vw]">
        
        {/* 1. BRANDING: Pocket CFO Logo */}
        <div className="flex items-center justify-center pr-3 lg:pr-5 border-r border-border/50 select-none shrink-0 gap-2">
          <WalletMinimal className="text-primary fill-primary/20 w-5 h-5 lg:w-6 lg:h-6 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="font-bold text-xs lg:text-sm tracking-tighter uppercase text-foreground">Pocket CFO</span>
        </div>

        {/* 2. Main Navigation Buttons */}
        <div className="flex items-center gap-0.5 lg:gap-1 pl-2 lg:pl-3 shrink-0">
          <NavButton to="/" active={currentPath === "/"} icon={<Crosshair size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Dashboard" subtitle="Overview" />
          <NavButton to="/macro" active={currentPath === "/macro"} icon={<LayoutDashboard size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Macro" subtitle="Trends" />
          <NavButton to="/meso" active={currentPath === "/meso"} icon={<PieChart size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Meso" subtitle="Habits" />
          <NavButton to="/micro" active={currentPath === "/micro"} icon={<TrendingUp size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Micro" subtitle="Anomalies" />
          <NavButton to="/explorer" active={currentPath === "/explorer"} icon={<PackageSearch size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Database" subtitle="Items" />
          <NavButton to="/ledger" active={currentPath === "/ledger"} icon={<FileText size={16} className="lg:w-[18px] lg:h-[18px]"/>} label="Ledger" subtitle="History" />
        </div>

        {/* 3. Utilities Column (Reordered for Cognitive Flow: Period -> Theme -> Guide -> Logout) */}
        <div className="flex items-center ml-2 lg:ml-3 pl-2 lg:pl-3 border-l border-border/50 gap-1 lg:gap-1.5 shrink-0">
          
          {/* Time Machine Dropdown */}
          <div className={`flex items-center transition-all duration-500 ease-in-out overflow-hidden ${showTimeMachine ? "max-w-[150px] lg:max-w-[200px] opacity-100 mr-1 lg:mr-2" : "max-w-0 opacity-0 mr-0"}`}>
            <div className="flex items-center gap-1 lg:gap-1.5 whitespace-nowrap bg-background/50 px-1.5 lg:px-2 py-1 rounded-md border border-border/50">
              <Calendar size={14} className="text-muted-foreground" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[11px] lg:text-xs font-bold text-foreground outline-none cursor-pointer appearance-none"
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-background text-foreground">{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Theme Switcher */}
          <ModeToggle />

          {/* Guide */}
          <Button 
            variant="ghost" size="sm" onClick={() => setIsHelpOpen(true)} 
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 lg:h-8 px-2 xl:px-3 rounded-full shrink-0"
          >
            <HelpCircle size={14} className="xl:mr-1.5" />
            <span className="hidden xl:inline text-[10px] font-bold">GUIDE</span>
          </Button>

          {/* Logout */}
          <Button 
            variant="ghost" size="sm" onClick={handleLogout} 
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 lg:h-8 px-2 xl:px-3 rounded-full shrink-0"
          >
            <LogOut size={14} className="xl:mr-1.5" />
            <span className="hidden xl:inline text-[10px] font-bold">LOGOUT</span>
          </Button>
        </div>
      </nav>

      {/* --- MOBILE NAVIGATION PANEL --- */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl flex justify-between items-center p-1.5 overflow-x-auto">
        <MobileNavButton to="/" active={currentPath === "/"} icon={<Crosshair size={20} />} label="Dash" />
        <MobileNavButton to="/macro" active={currentPath === "/macro"} icon={<LayoutDashboard size={20} />} label="Macro" />
        <MobileNavButton to="/meso" active={currentPath === "/meso"} icon={<PieChart size={20} />} label="Meso" />
        <MobileNavButton to="/micro" active={currentPath === "/micro"} icon={<TrendingUp size={20} />} label="Micro" />
        <MobileNavButton to="/explorer" active={currentPath === "/explorer"} icon={<PackageSearch size={20} />} label="Data" />
        <MobileNavButton to="/ledger" active={currentPath === "/ledger"} icon={<FileText size={20} />} label="Ledger" />
      </div>
    </>
  );
}

// --- MAIN COMPONENT FRAME ---
function AppContent() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { theme, setTheme } = useTheme();

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthRaw());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Cycle Theme Logic for Mobile Dropdown
  const cycleTheme = () => {
    if (theme === 'system') setTheme('light')
    else if (theme === 'light') setTheme('dark')
    else setTheme('system')
  }

  // --- DYNAMIC BROWSER TITLE LOGIC ---
  useEffect(() => {
    const baseTitle = "Pocket CFO";
    const titleMap: Record<string, string> = {
      "/": "Dashboard Overview",
      "/macro": "Macro Trends",
      "/meso": "Meso Habits",
      "/micro": "Micro Anomalies",
      "/explorer": "Database Explorer",
      "/ledger": "Transaction Ledger",
    };

    if (!session) {
      document.title = `Login | ${baseTitle}`;
    } else {
      const pageTitle = titleMap[currentPath] || "System";
      document.title = `${pageTitle} | ${baseTitle}`;
    }
  }, [currentPath, session]); 

  // Security & Inactivity Layer
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
  const logoutTimerRef = useRef<number | null>(null);

  const resetInactivityTimer = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = window.setTimeout(() => {
      if (session) {
        supabase.auth.signOut();
        alert("Your session has expired due to 15 minutes of inactivity. Please log in again.");
      }
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    if (session) {
      const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
      events.forEach(event => window.addEventListener(event, resetInactivityTimer));
      resetInactivityTimer();

      return () => {
        events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      };
    }
  }, [session]);

  const currentUserId = session?.user?.id; 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out of Pocket CFO?")) {
      await supabase.auth.signOut();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-mono text-sm tracking-widest">
        INITIALIZING POCKET CFO...
      </div>
    );
  }

  if (!session) return <Login />;

  const showTimeMachine = currentPath === '/macro' || currentPath === '/meso' || currentPath === '/ledger';

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col relative overflow-x-hidden">
      
      {/* --- MOBILE TOP HEADER --- */}
      <header className="md:hidden sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/50 px-3 py-3 flex justify-between items-center">
        <div className="flex items-center gap-1.5 shrink-0">
          <WalletMinimal className="text-primary fill-primary/20 w-5 h-5 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0" />
          <span className="font-bold text-sm tracking-tighter uppercase text-foreground truncate max-w-[110px]">Pocket CFO</span>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          
          <div className={`flex items-center gap-1 px-1.5 py-1 bg-secondary/50 rounded-md border border-border/50 transition-all duration-300 ${!showTimeMachine ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}`}>
            <Calendar size={12} className="text-muted-foreground shrink-0" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={!showTimeMachine}
              className="bg-transparent text-[11px] font-bold text-foreground outline-none cursor-pointer appearance-none disabled:cursor-not-allowed max-w-[65px]"
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                  {opt.label.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card border-border shadow-xl">
              <DropdownMenuItem onClick={cycleTheme} className="text-xs font-bold cursor-pointer">
                {theme === 'light' ? <Sun size={14} className="mr-2 text-amber-500" /> : theme === 'dark' ? <Moon size={14} className="mr-2 text-primary" /> : <Monitor size={14} className="mr-2 text-muted-foreground" />}
                Theme: <span className="capitalize ml-1">{theme}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => setIsHelpOpen(true)} className="text-xs font-bold cursor-pointer">
                <HelpCircle size={14} className="mr-2 text-muted-foreground" />
                Guide
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={handleLogout} className="text-xs font-bold cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                <LogOut size={14} className="mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
      </header>

      {/* RENDER DESKTOP & MOBILE NAVIGATION */}
      <AppNavigation 
        currentPath={currentPath}
        showTimeMachine={showTimeMachine}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        setIsHelpOpen={setIsHelpOpen}
        handleLogout={handleLogout}
      />

      {/* --- MAIN CONTENT AREA WITH ROUTES --- */}
      <main className="flex-1 pt-4 md:pt-28 lg:pt-28 pb-24 md:pb-12 px-2 md:px-8 max-w-7xl mx-auto w-full relative z-10">
        <Routes>
          <Route path="/" element={<CFODashboard userId={currentUserId!} />} />
          <Route path="/macro" element={<MacroDashboard targetMonth={selectedMonth} />} />
          <Route path="/meso" element={<MesoDashboard targetMonth={selectedMonth} />} />
          <Route path="/micro" element={<MicroDashboard />} />
          <Route path="/explorer" element={<ItemExplorer />} />
          <Route path="/ledger" element={<TransactionLedger targetMonth={selectedMonth} userId={currentUserId!} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* --- CONTEXTUAL HELP MODAL (FIXED OVERFLOW BUGS) --- */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        {/* max-h-[85vh] ensures the modal fits the screen regardless of monitor height */}
        <DialogContent className="w-[95vw] sm:max-w-[550px] max-h-[85vh] bg-card border-border shadow-2xl rounded-2xl p-0 flex flex-col overflow-hidden">
          
          {/* Static Header (Non-scrollable) */}
          <div className="p-5 md:p-6 bg-muted/10 border-b border-border/50 relative shrink-0">
            <Send className="absolute -bottom-2 -right-2 w-20 h-20 text-primary/5 rotate-12" strokeWidth={1}/>
            <DialogTitle className="flex items-center gap-2 text-primary text-xl relative z-10">
              <Send size={20} /> Telegram AI Assistant
            </DialogTitle>
            <DialogDescription className="text-xs mt-1.5 text-muted-foreground leading-relaxed relative z-10">
              Your Pocket CFO is powered by Gemini AI. You don't need strict formats. Just talk to it naturally or send a photo, and the AI will extract the data.
            </DialogDescription>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
            
            {/* Method 1: The Magic (AI OCR) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Method 1: AI Auto-Extract (Recommended)
              </h4>
              <div className="bg-background rounded-lg border border-border p-3 space-y-2.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">Send a <strong className="text-foreground">Photo of a Receipt</strong> (Super Indo, Indomaret, etc.) or a <strong className="text-foreground">Screenshot</strong> of your Grab/Gojek history. The AI will read the items, prices, and categories automatically.</p>
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-1 rounded">OR SEND NATURAL TEXT:</span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-mono text-foreground bg-muted/50 p-2 rounded border border-border/50">"Makan siang soto ayam 25rb pake qris"</p>
                  <p className="text-xs font-mono text-foreground bg-muted/50 p-2 rounded border border-border/50">"+5000000 gaji dari PT ABC"</p>
                </div>
                <p className="text-[9px] text-muted-foreground italic mt-2">*Note: Add '+' before amount for Income. The AI assigns GoPay/OVO for Gojek/Grab.</p>
              </div>
            </div>

            {/* Method 2: Manual Command */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 opacity-70">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Method 2: Manual Legacy Command
              </h4>
              <div className="bg-background rounded-lg border border-border p-3 space-y-2 opacity-70">
                <p className="text-[11px] text-muted-foreground">If AI interpretation fails or for strict offline entry:</p>
                <p className="text-[10px] font-mono text-muted-foreground break-all bg-muted p-1 rounded">/record [Amount] [Category] [Merchant] [Method]</p>
                <div className="space-y-1">
                  <p className="text-xs font-mono text-foreground bg-muted/50 p-1.5 rounded">/record 15000 Transportasi KRL bca</p>
                </div>
              </div>
            </div>

            {/* Features & Security Footnote */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="bg-muted/30 p-2 rounded-lg">
                <p className="text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Undo Feature</p>
                <p className="text-[10px] text-muted-foreground">Single OCR entries have a 10-minute "Undo" button directly in Telegram.</p>
              </div>
              <div className="bg-muted/30 p-2 rounded-lg">
                <p className="text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Security Layer</p>
                <p className="text-[10px] text-muted-foreground">Only registered Telegram IDs (CFO Family) can send data to this bot.</p>
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Navigation Button Components (Links) ---
function NavButton({ active, to, icon, label, subtitle }: { active: boolean, to: string, icon: React.ReactNode, label: string, subtitle?: string }) {
  return (
    <Link
      to={to}
      title={subtitle ? `${label} - ${subtitle}` : label} 
      className={`flex items-center gap-1.5 lg:gap-2.5 px-3 lg:px-4 py-2 lg:py-2.5 rounded-full transition-all duration-150 ${
        active 
          ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
      }`}
    >
      <span className="shrink-0 scale-90 lg:scale-100">{icon}</span>
      <span className="text-[11px] lg:text-[13px] font-semibold leading-none hidden sm:block">
        {label}
      </span>
    </Link>
  );
}

function MobileNavButton({ active, to, icon, label }: { active: boolean, to: string, icon: React.ReactNode, label: string }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-2.5 rounded-xl transition-all duration-150 ${
        active ? "text-primary bg-primary/10" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </Link>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}