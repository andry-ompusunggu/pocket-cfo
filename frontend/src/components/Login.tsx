// src/components/Login.tsx
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { WalletMinimal, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login Error:", error);
      // Protect database schema by using generic global standard error messages
      setError(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : 'System error during authentication.');
      setLoading(false);
    }
    // On success, the Supabase auth state listener in App.tsx will handle redirection
  };

  return (
    <div className="h-[100dvh] w-full bg-background flex items-center justify-center p-6 overflow-hidden">
      {/* Background glow effect for an elegant Cyber/Control Room aesthetic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-primary/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-[380px] bg-card/50 backdrop-blur-xl border-border shadow-2xl relative z-10 -translate-y-4 md:translate-y-0">
        <CardHeader className="space-y-3 text-center pb-6">
          {/* Synchronized icon with App.tsx branding (WalletMinimal + Glow) */}
          <div className="w-14 h-14 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20 mb-2">
            <WalletMinimal size={30} className="text-primary drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Pocket CFO
            </CardTitle>
            <CardDescription className="text-muted-foreground text-[10px] uppercase tracking-[0.2em] font-mono font-bold">
              Secure Auth Required
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-[11px] p-3 rounded-lg flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  type="email" 
                  placeholder="Email Address" 
                  className="pl-10 bg-background/50 border-border h-11 text-sm focus-visible:ring-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  type="password" 
                  placeholder="Password" 
                  className="pl-10 bg-background/50 border-border h-11 text-sm font-mono focus-visible:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="pt-2 pb-8 md:pb-6">
            <Button 
              type="submit" 
              className="w-full h-11 font-bold tracking-wide text-primary-foreground bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AUTHENTICATING...</>
              ) : (
                "ACCESS DASHBOARD"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}