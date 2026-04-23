-- ==========================================
-- SEED DATA: POCKET-CFO (DEMO CONTEXT)
-- ==========================================
-- IMPORTANT: Please follow the README instructions to get your Auth UID and Telegram ID.

DO $$ 
DECLARE 
    -- ⚠️ REPLACE THESE TWO VARIABLES WITH YOUR ACTUAL DATA ⚠️
    demo_user_id UUID := '00000000-0000-0000-0000-000000000000'; 
    my_telegram_id BIGINT := 123456789; 
    
    trans_id UUID;
BEGIN
    -- 1. Initialize Demo Profile
    INSERT INTO public.profiles (id, full_name, telegram_id, role)
    VALUES (demo_user_id, 'Budi Santoso (Demo User)', my_telegram_id, 'member')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Monthly Budgets (Adjusted for ~5.5M Income)
    INSERT INTO public.budgets (user_id, category, amount, period)
    VALUES 
        (demo_user_id, 'Makanan & Minuman', 1500000, 'monthly'), -- ~50k/hari
        (demo_user_id, 'Belanja Bulanan', 600000, 'monthly'),
        (demo_user_id, 'Transportasi', 400000, 'monthly'),
        (demo_user_id, 'Tagihan', 1200000, 'monthly') -- Kost 900k + Listrik/Internet 300k
    ON CONFLICT DO NOTHING;

    -- 3. Sinking Funds (Realistic Savings Goals)
    INSERT INTO public.sinking_funds (user_id, goal_name, target_amount, target_date, current_saved)
    VALUES 
        (demo_user_id, 'Liburan ke Bali 2027', 3500000, '2027-08-15', 750000),
        (demo_user_id, 'Dana Darurat (3 Bulan)', 10000000, '2028-12-31', 2500000)
    ON CONFLICT DO NOTHING;

    -- 4. Sample Transactions
    -- Monthly Income (UMK+ Surabaya)
    INSERT INTO public.transactions (user_id, type, transaction_timestamp, merchant, category, total_amount, financial_nature, is_fixed_cost)
    VALUES (demo_user_id, 'income', now() - interval '20 days', 'PT Maju Bersama', 'Gaji', 5500000, 'need', true);

    -- Monthly Fixed Costs (Rent - Surabaya)
    INSERT INTO public.transactions (user_id, type, transaction_timestamp, merchant, category, total_amount, financial_nature, is_fixed_cost)
    VALUES (demo_user_id, 'expense', now() - interval '19 days', 'Kost Ngagel Surabaya', 'Tagihan', 900000, 'need', true);

    -- Grocery Transaction (Super Indo Surabaya)
    INSERT INTO public.transactions (user_id, type, transaction_timestamp, location, merchant, category, subtotal, tax_amount, total_amount, financial_nature, payment_method)
    VALUES (demo_user_id, 'expense', now() - interval '15 days', 'Surabaya', 'LION SUPER INDO', 'Belanja Bulanan', 185000, 0, 185000, 'need', 'Debit')
    RETURNING id INTO trans_id;

    -- Detailed Grocery Items (Math equals 185,000)
    INSERT INTO public.transaction_items (transaction_id, raw_name, standard_name, quantity, unit, base_price, final_price)
    VALUES 
        (trans_id, 'Minyak Goreng 2L', 'Minyak Goreng', 1, 'pcs', 36000, 36000),
        (trans_id, 'Beras Medium 5kg', 'Beras', 1, 'pcs', 74000, 74000),
        (trans_id, 'Telur Ayam Ras 1kg', 'Telur', 1, 'kg', 28000, 28000),
        (trans_id, 'Deterjen Cair 750ml', 'Kebutuhan Rumah', 1, 'pcs', 22000, 22000),
        (trans_id, 'Sabun Mandi Cair', 'Kebutuhan Rumah', 1, 'pcs', 25000, 25000);

    -- Variable Expense (Coffee/Lifestyle - Normal Price)
    INSERT INTO public.transactions (user_id, type, transaction_timestamp, merchant, category, total_amount, financial_nature, payment_method)
    VALUES (demo_user_id, 'expense', now() - interval '2 days', 'Kopi Kenangan', 'Makanan & Minuman', 18000, 'want', 'QRIS');

    -- Transportation Expense (Gojek short distance)
    INSERT INTO public.transactions (user_id, type, transaction_timestamp, merchant, category, total_amount, financial_nature, payment_method)
    VALUES (demo_user_id, 'expense', now() - interval '1 day', 'Gojek', 'Transportasi', 14500, 'need', 'GoPay');

END $$;