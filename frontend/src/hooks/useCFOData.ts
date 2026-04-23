import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; 

export interface CFOMetrics {
    gross_income: number;
    total_fixed_costs: number;
    mandatory_savings: number;
    real_disposable_income: number;
    spent_so_far: number;
    daily_burn_rate: number;
    projected_end_of_month_expense: number;
    sinking_fund_target: number;
    sinking_fund_saved: number;
    sinking_fund_name: string;
    sinking_fund_date: string;
}

export const useCFOData = (userId: string | number) => {
    const [data, setData] = useState<CFOMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        const fetchCFOData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Real Disposable Income (Automatically secured by View Security Invoker)
                const { data: incomeData, error: incomeErr } = await supabase
                    .from('vw_cfo_disposable_income')
                    .select('*')
                    .limit(1)
                    .single();

                if (incomeErr && incomeErr.code !== 'PGRST116') throw incomeErr;

                // 2. Fetch Burn Rate Data (Automatically secured by View Security Invoker)
                const { data: burnData, error: burnErr } = await supabase
                    .from('vw_burn_rate_predictor')
                    .select('*')
                    .limit(1)
                    .single();

                if (burnErr && burnErr.code !== 'PGRST116') throw burnErr;

                // 3. Fetch Sinking Fund Data (Base table, requires explicit .eq user_id filter)
                const { data: sinkingData, error: sinkingErr } = await supabase
                    .from('sinking_funds')
                    .select('goal_name, target_amount, current_saved, target_date')
                    .eq('user_id', userId)
                    .order('target_date', { ascending: true })
                    .limit(1)
                    .single();

                if (sinkingErr && sinkingErr.code !== 'PGRST116') throw sinkingErr;

                setData({
                    gross_income: incomeData?.gross_income || 0,
                    total_fixed_costs: incomeData?.total_fixed_costs || 0,
                    mandatory_savings: incomeData?.mandatory_savings || 0,
                    real_disposable_income: incomeData?.real_disposable_income || 0,
                    spent_so_far: burnData?.spent_so_far || 0,
                    daily_burn_rate: burnData?.daily_burn_rate || 0,
                    projected_end_of_month_expense: burnData?.projected_end_of_month_expense || 0,
                    sinking_fund_target: sinkingData?.target_amount || 0,
                    sinking_fund_saved: sinkingData?.current_saved || 0,
                    sinking_fund_name: sinkingData?.goal_name || "Primary Goal",
                    sinking_fund_date: sinkingData?.target_date || "",
                });

            } catch (err: any) {
                console.error("Failed to fetch CFO data:", err);
                // Masking error detail to protect database structure
                setError("System data synchronization failed. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchCFOData();
    }, [userId]);

    return { data, isLoading, error };
};