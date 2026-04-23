const { Telegraf, Markup } = require('telegraf');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// Initialize Core Clients
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let config = {
    provider: 'gemini',
    ollamaModel: 'minicpm-v',
    geminiModel: 'gemini-2.5-flash'
};

/**
 * SYSTEM_PROMPT: Optimized for high-precision financial data extraction.
 * Refactored to English for global technical auditability while maintaining 
 * Indonesian context for category classification.
 */
const SYSTEM_PROMPT = `
You are a Senior Data Engineer specializing in receipt OCR and transaction history extraction.
Your mission is to parse text or images into a strictly valid JSON array.
NEVER hallucinate data. Extract precisely what is visible.

IMPORTANT: Output MUST ALWAYS be an ARRAY of JSON Objects, even for a single receipt: [ { ... } ].

TRANSACTION HEADER RULES (For each Object in Array):
1. "type": Context detection. Use "income" for salary, bonus, refund. Use "expense" for purchases.
2. "transaction_timestamp": ISO format with WIB timezone (+07:00). Example: "YYYY-MM-DDTHH:mm:ss+07:00".
3. "location": City/Area (e.g., "Jakarta", "Surabaya"). If unknown, use null.
4. "merchant": Entity/Store name.
5. "category": Strictly use these Indonesian labels:
   - For Expense: [Makanan & Minuman, Belanja Bulanan, Transportasi, Tagihan, Lainnya].
   - For Income: [Gaji, Bonus, Pendapatan Lain].
6. "payment_method": Auto-set "OVO" if merchant is "Grab". Auto-set "GoPay" if merchant is "Gojek". Otherwise, detect from text (Debit, Cash, QRIS, etc).
7. "subtotal": Pre-tax/fee amount. Default 0.
8. "tax_amount": Tax/Service charge. Default 0.
9. "admin_fee": Service/Platform fee. Default 0.
10. "total_amount": Final amount paid.
11. "financial_nature": For expense: "need" (essential), "want" (lifestyle), or "saving". If "type" is "income", always set to "need".
12. "is_fixed_cost": Boolean. True ONLY for recurring monthly obligations (Rent, Subscription). False for casual purchases or income.

ITEMIZED LIST RULES:
1. "raw_name": Item name exactly as written (e.g., "SUNPRIDE PISANG W").
2. "standard_name": Common name (e.g., "Pisang").
3. "quantity": Numeric QTY. Default 1.
4. "unit": Unit type (e.g., "pcs", "gram", "kg", "pack", "trip").
5. "base_price": Unit price before discounts.
6. "discount": Positive numeric value if a discount line (e.g., "HEMAT") is present for the item.
7. "final_price": Total line amount for the item.

SPECIAL HEURISTICS:
- If "Pepaya" or similar fruit is bought at a grocery store, classify under "Makanan & Minuman", NOT "Belanja Bulanan".
- For multi-transaction history screenshots (e.g., Gojek/Grab history), create a SEPARATE object for EACH row.

EXAMPLE OUTPUT (Expense):
[
  {
    "type": "expense",
    "merchant": "LION SUPER INDO",
    "category": "Belanja Bulanan",
    "total_amount": 180775,
    "transaction_timestamp": "2026-03-29T12:16:17+07:00",
    "payment_method": "Debit",
    "financial_nature": "need",
    "is_fixed_cost": false,
    "items": [
      { 
        "raw_name": "SUNPRIDE PISANG W",
        "standard_name": "Pisang",
        "quantity": 648,
        "unit": "gram",
        "base_price": 26900,
        "discount": 4795,
        "final_price": 17430 
      }
    ]
  }
]
`;

// --- AI ENGINE WRAPPERS ---

async function callGemini(contentArray) {
    const fallbackModels = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
    const maxRetriesPerModel = 2; 

    for (const modelName of fallbackModels) {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });

        let delayMs = 1500; 

        for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
            try {
                const result = await model.generateContent(contentArray);
                console.log(`[INFO] Extraction successful using model: ${modelName}`);
                return result.response.text();
            } catch (error) {
                const isServerBusy = error.status === 503 || error.status === 429;
                
                if (isServerBusy) {
                    if (attempt < maxRetriesPerModel) {
                        console.warn(`[WARN] Model ${modelName} busy. Retrying ${attempt}/${maxRetriesPerModel}...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                        delayMs *= 2; 
                    }
                } else {
                    console.error(`[ERROR] Model ${modelName} fatal error:`, error.message);
                    break;
                }
            }
        }
    }
    throw new Error("AI services unavailable.");
}

async function callOllama(isPhoto, base64Data, textPrompt) {
    const payload = {
        model: config.ollamaModel,
        messages: [{
            role: "user",
            content: SYSTEM_PROMPT + "\n\nUser Context: " + textPrompt,
            images: isPhoto ? [base64Data] : []
        }],
        stream: false,
        format: "json"
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.message.content;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// --- TELEGRAM MIDDLEWARE ---

bot.use(async (ctx, next) => {
    if (!ctx.from) return;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('telegram_id', ctx.from.id)
        .single();

    if (error || !profile) {
        console.warn(`[SECURITY] Unauthorized access blocked from ID: ${ctx.from.id}`); 
        return ctx.reply("⛔ Access Denied. Your Telegram account is not linked to any CFO Profile.");
    }

    ctx.state.userUuid = profile.id;
    ctx.state.userName = profile.full_name || 'User';
    
    return next();
});

// --- COMMAND HANDLERS ---

bot.command('model', (ctx) => {
    const target = ctx.message.text.split(' ')[1];
    if (target === 'gemini' || target === 'ollama') {
        config.provider = target;
        ctx.reply(`🔄 Provider switched to: *${target.toUpperCase()}*`, { parse_mode: 'Markdown' });
    } else {
        ctx.reply(`Current Provider: ${config.provider}\nUsage: /model gemini|ollama`);
    }
});

bot.command('last', async (ctx) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('merchant, total_amount, created_at')
            .eq('user_id', ctx.state.userUuid)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        if (!data || data.length === 0) return ctx.reply("No transactions recorded yet.");

        let msg = "🗓️ *Last 5 Transactions:*\n\n";
        data.forEach((trx, i) => {
            const dateWIB = new Date(trx.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
            msg += `${i + 1}. *${trx.merchant}*\n   Rp${trx.total_amount.toLocaleString('id-ID')} (${dateWIB})\n`;
        });

        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (err) {
        console.error(`[ERROR] Fetch failed: ${err.message}`); 
        ctx.reply("❌ Failed to retrieve recent transactions.");
    }
});

bot.command('record', async (ctx) => {
    const text = ctx.message.text.replace('/record ', '').trim();
    const parts = text.split(' ');

    if (parts.length < 3) {
        return ctx.reply("❌ Invalid Format!\nUse: `/record [Amount] [Category] [Merchant] [Method]`\nExample: `/record 25000 Makanan Nasi Goreng cash`", { parse_mode: 'Markdown' });
    }

    const nominal = parseInt(parts[0]);
    const kategoriInput = parts[1];
    let merchantInput = parts.slice(2).join(' ');
    let finalCategory = kategoriInput;
    let paymentMethod = 'GoPay'; 

    const knownMethods = ['ovo', 'gopay', 'cash', 'tunai', 'bca', 'bni', 'mandiri', 'qris', 'jago', 'blu'];
    const lastWord = parts[parts.length - 1].toLowerCase();
    
    if (knownMethods.includes(lastWord)) {
        paymentMethod = parts[parts.length - 1]; 
        merchantInput = parts.slice(2, parts.length - 1).join(' ');
        if (paymentMethod.toLowerCase() === 'tunai') paymentMethod = 'Cash';
        if (paymentMethod.toLowerCase() === 'qris') paymentMethod = 'GoPay'; 
    }

    if (isNaN(nominal)) return ctx.reply("❌ Amount must be a number.");

    try {
        const { data: trxData, error: trxError } = await supabase
            .from('transactions')
            .insert({
                user_id: ctx.state.userUuid, 
                type: 'expense',
                transaction_timestamp: new Date().toISOString(),
                merchant: merchantInput,
                category: finalCategory,
                payment_method: paymentMethod,
                total_amount: nominal,
                financial_nature: 'need', 
                is_fixed_cost: false
            })
            .select('id, created_at')
            .single();

        if (trxError) throw trxError;

        await supabase.from('transaction_items').insert({
            transaction_id: trxData.id,
            raw_name: merchantInput,
            standard_name: merchantInput,
            quantity: 1,
            unit: 'trx',
            base_price: nominal,
            discount: 0,
            final_price: nominal
        });

        ctx.reply(`✅ *TRANSACTION RECORDED*\n\n💰 *Rp${nominal.toLocaleString('id-ID')}*\n🏢 *${merchantInput}*\n📦 *${finalCategory}*\n💳 *${paymentMethod}*`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                Markup.button.callback('↩️ Undo Transaction', `undo_${trxData.id}`)
            ])
        });

    } catch (err) {
        console.error(`[ERROR] Manual entry failed: ${err.message}`); 
        ctx.reply("❌ System error while saving record.");
    }
});

bot.action(/^undo_(.+)$/, async (ctx) => {
    const trxId = ctx.match[1];

    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('created_at, merchant, total_amount, user_id')
            .eq('id', trxId)
            .single();

        if (error || !data) return await ctx.answerCbQuery("Data not found.", { show_alert: true });
        if (data.user_id !== ctx.state.userUuid) return await ctx.answerCbQuery("Unauthorized.", { show_alert: true });

        const diffInMinutes = (new Date() - new Date(data.created_at)) / 60000;
        if (diffInMinutes > 10) return await ctx.answerCbQuery("Time limit (10m) expired.", { show_alert: true });

        await supabase.from('transactions').delete().eq('id', trxId);

        await ctx.answerCbQuery("✅ Undo Successful!");
        await ctx.editMessageText(`❌ *CANCELLED*\n\n*${data.merchant}* (Rp${data.total_amount.toLocaleString('id-ID')}) has been permanently removed.`, { parse_mode: 'Markdown' });

    } catch (err) {
        console.error(`[ERROR] Undo failed: ${err.message}`);
    }
});

bot.command('setbudget', async (ctx) => {
    const match = ctx.message.text.match(/\/setbudget\s+(.+)\s+(\d+)/i);
    if (!match) return ctx.reply("Example: `/setbudget Makanan 2000000`", { parse_mode: 'Markdown' });

    const category = match[1].trim();
    const amount = parseInt(match[2]);
    const period = new Date().toISOString().slice(0, 7); 

    try {
        const { error } = await supabase.from('budgets').upsert({ user_id: ctx.state.userUuid, category, amount, period }, { onConflict: 'user_id, category, period' });
        if (error) throw error;
        ctx.reply(`✅ Budget for *${category}* set to *Rp${amount.toLocaleString('id-ID')}* for this period.`, { parse_mode: 'Markdown' });
    } catch (e) { 
        ctx.reply("❌ Failed to set budget."); 
    }
});

bot.command('monthly', async (ctx) => {
    try {
        const nowWIB = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        const period = `${nowWIB.getFullYear()}-${String(nowWIB.getMonth() + 1).padStart(2, '0')}`;
        const startOfMonthISO = `${period}-01T00:00:00+07:00`;

        const [trxRes, budgetRes] = await Promise.all([
            supabase.from('transactions').select('category, total_amount').eq('user_id', ctx.state.userUuid).gte('transaction_timestamp', startOfMonthISO), 
            supabase.from('budgets').select('category, amount').eq('user_id', ctx.state.userUuid).eq('period', period)
        ]);

        if (trxRes.error || budgetRes.error) throw new Error("DB error");

        let totalExp = 0;
        const catExp = {};
        trxRes.data.forEach(t => {
            totalExp += Number(t.total_amount);
            catExp[t.category] = (catExp[t.category] || 0) + Number(t.total_amount);
        });

        const budgets = {};
        budgetRes.data.forEach(b => budgets[b.category] = b.amount);

        let msg = `📊 *MONTHLY SUMMARY (${period})*\n💰 *Total: Rp${totalExp.toLocaleString('id-ID')}*\n\n`;

        Object.entries(catExp).sort((a,b) => b[1]-a[1]).forEach(([cat, amount]) => {
            const limit = budgets[cat];
            let budgetInfo = "";
            if (limit) {
                const percent = Math.round((amount / limit) * 100);
                const status = percent >= 100 ? "🚨 OVER" : (percent >= 80 ? "⚠️ Warning" : "✅ Safe");
                budgetInfo = `\n   └ ${status} (${percent}% of Rp${limit.toLocaleString('id-ID')})`;
            }
            msg += `- *${cat}*: Rp${amount.toLocaleString('id-ID')}${budgetInfo}\n`;
        });

        ctx.reply(msg || "No expenses recorded this month.", { parse_mode: 'Markdown' });
    } catch (e) { 
        ctx.reply("❌ Calculation failed."); 
    }
});

bot.command('search', async (ctx) => {
    const keyword = ctx.message.text.split(' ').slice(1).join(' ');
    if (!keyword) return ctx.reply("Usage: `/search [merchant/category]`");

    try {
        const { data, error } = await supabase.from('transactions').select('merchant, total_amount, transaction_timestamp').eq('user_id', ctx.state.userUuid).ilike('merchant', `%${keyword}%`).order('transaction_timestamp', { ascending: false }).limit(10);
        if (error) throw error;
        if (!data.length) return ctx.reply(`🔍 No transactions found for "${keyword}"`);

        let msg = `🔍 *Search Results for "${keyword}":*\n\n`;
        data.forEach((trx, i) => {
            const t = new Date(trx.transaction_timestamp).toLocaleDateString('id-ID');
            msg += `${i+1}. *${trx.merchant}* - Rp${trx.total_amount.toLocaleString('id-ID')} (${t})\n`;
        });
        ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) { 
        ctx.reply("❌ Search failed."); 
    }
});

bot.command('export', async (ctx) => {
    try {
        const { data, error } = await supabase.from('transactions').select('transaction_timestamp, merchant, category, total_amount, payment_method').eq('user_id', ctx.state.userUuid).order('transaction_timestamp', { ascending: false }); 
        if (error) throw error;

        let csv = "Date,Merchant,Category,Total,Payment\n";
        data.forEach(t => {
            const date = new Date(t.transaction_timestamp).toLocaleDateString('id-ID');
            csv += `"${date}","${t.merchant}","${t.category}",${t.total_amount},"${t.payment_method}"\n`;
        });

        const buffer = Buffer.from(csv, 'utf-8');
        await ctx.replyWithDocument({ source: buffer, filename: `Financial_Report_${ctx.state.userName}.csv` }); 
    } catch (e) { 
        ctx.reply("❌ Export failed."); 
    }
});

// --- CORE MESSAGE HANDLER (AI ENGINE) ---

bot.on('message', async (ctx) => {
    const isText = ctx.message.text;
    const isPhoto = ctx.message.photo;
    const isDocument = ctx.message.document;

    if (isText && !isPhoto && isText.length < 15) {
        return ctx.reply(`Hello ${ctx.state.userName}! 👋 I'm your AI Financial Officer. Please send a receipt photo or transaction details.`); 
    }

    if (!isText && !isPhoto && !isDocument) return;
    if (isText && isText.startsWith('/')) return;

    const processingMsg = await ctx.reply("⏳ *Analyzing data...*", { parse_mode: 'Markdown' });
    ctx.sendChatAction('typing');

    try {
        let responseText = '';
        let fileId = isPhoto ? isPhoto[isPhoto.length - 1].file_id : (isDocument?.mime_type?.startsWith('image/') ? isDocument.file_id : null);
        let base64Image = '';
        let userCaption = ctx.message.caption || isText || '';

        if (fileId) {
            const fileUrl = await ctx.telegram.getFileLink(fileId);
            const response = await fetch(fileUrl.href);
            const arrayBuffer = await response.arrayBuffer();
            base64Image = Buffer.from(arrayBuffer).toString('base64');
        }

        if (config.provider === 'ollama') {
            responseText = await callOllama(!!fileId, base64Image, userCaption);
        } else {
            const content = fileId ? [SYSTEM_PROMPT + `\nContext: ${userCaption}`, { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }] : [SYSTEM_PROMPT + `\nContext: ${userCaption}`];
            responseText = await callGemini(content);
        }

        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        let dataArr = JSON.parse(responseText);
        if (!Array.isArray(dataArr)) dataArr = [dataArr];

        const insertPromises = dataArr.map(trx => {
            return supabase.rpc('create_transaction', {
                p_user_id: ctx.state.userUuid, 
                p_type: trx.type || 'expense',
                p_transaction_timestamp: trx.transaction_timestamp || new Date().toISOString(),
                p_location: trx.location || null, 
                p_merchant: trx.merchant || 'Unknown',
                p_category: trx.category || 'Lainnya',
                p_payment_method: trx.payment_method || 'Cash', 
                p_subtotal: trx.subtotal || 0,   
                p_tax_amount: trx.tax_amount || 0, 
                p_admin_fee: trx.admin_fee || 0,   
                p_total_amount: trx.total_amount || 0,
                p_financial_nature: trx.financial_nature || 'need',
                p_is_fixed_cost: trx.is_fixed_cost || false,
                p_items: trx.items || [] 
            });
        });

        const results = await Promise.all(insertPromises);
        
        let grandTotal = 0;
        let replyMsg = `✅ *AUTO-EXTRACT SUCCESS (${config.provider.toUpperCase()})*\n\n`;
        let singleInsertedId = null;

        dataArr.forEach((trx, i) => {
            grandTotal += Number(trx.total_amount || 0);
            replyMsg += `${i + 1}. *${trx.merchant}* - Rp${(trx.total_amount).toLocaleString('id-ID')}\n`;
            replyMsg += `   └ 📦 ${trx.category}\n`;
            if (i === 0) singleInsertedId = results[i]?.data;
        });

        replyMsg += `\n💰 *Total: Rp${grandTotal.toLocaleString('id-ID')}*`;

        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        
        if (dataArr.length === 1 && singleInsertedId) {
            ctx.reply(replyMsg, { 
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([Markup.button.callback(`↩️ Undo`, `undo_${singleInsertedId}`)])
            });
        } else {
            ctx.reply(replyMsg, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error(`[CRITICAL] Error: ${error.message}`); 
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        ctx.reply(`❌ Failed to extract data. Please ensure the receipt is clear.`);
    }
});

// --- VERCEL WEBHOOK HANDLER ---

const processedUpdates = new Set();

module.exports = async (req, res) => {
    try {
        if (req.method !== 'POST') return res.status(200).send('Security Layer Active 🛡️');

        const secretToken = req.headers['x-telegram-bot-api-secret-token'];
        if (secretToken !== process.env.WEBHOOK_SECRET) return res.status(403).send('Forbidden');

        const updateId = req.body.update_id;
        if (updateId) {
            if (processedUpdates.has(updateId)) return res.status(200).send('OK');
            processedUpdates.add(updateId);
            if (processedUpdates.size > 100) processedUpdates.delete(processedUpdates.values().next().value);
        }

        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (err) {
        console.error(`[WEBHOOK ERROR] ${err.message}`);
        res.status(200).send('Error Processed'); 
    }
};
