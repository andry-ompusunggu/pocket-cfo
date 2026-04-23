// TransactionLedger.tsx

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  FileText, Search, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, 
  Trash2, Edit3, Save, X,
  PlusCircle, MapPin, Globe, AlertCircle,
  ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatIDR, formatDate } from '@/lib/formatters';

// --- Types (Sesuai DDL Supabase) ---
interface TransactionItem {
  id: string; 
  transaction_id: string;
  raw_name: string; 
  standard_name: string; 
  brand: string | null;
  quantity: number; 
  unit: string; 
  base_price: number; 
  discount: number; 
  final_price: number;
}

interface Transaction {
  id: string; 
  type: string;
  transaction_timestamp: string; 
  location: string | null;
  merchant: string; 
  category: string; 
  payment_method: string | null; 
  subtotal: number | null;
  tax_amount: number | null;
  admin_fee: number | null;
  total_amount: number; 
  financial_nature: string | null;
  is_fixed_cost: boolean | null;
  transaction_items: TransactionItem[];
}

// Helper untuk datetime-local input
const formatForInput = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function TransactionLedger({ targetMonth, userId }: { targetMonth: string, userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [payment, _setPayment] = useState("all");
  const [sortBy, setSortBy] = useState("transaction_timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);

  const [_selectedTrx, setSelectedTrx] = useState<Transaction | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTransactions = async () => {
    setIsLoading(true);
    const startDate = `${targetMonth}-01`;
    const [year, month] = targetMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${targetMonth}-${lastDay}`;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('transactions')
      .select('*, transaction_items(*)', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (!isGlobalSearch) {
      query = query
        .gte('transaction_timestamp', `${startDate}T00:00:00+07:00`)
        .lte('transaction_timestamp', `${endDate}T23:59:59+07:00`);
    }

    if (search) query = query.ilike('merchant', `%${search}%`);
    if (category !== "all") query = query.eq('category', category);
    if (payment !== "all") query = query.eq('payment_method', payment);

    query = query.order(sortBy, { ascending: sortOrder === "asc" });
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (data) setTransactions(data);
    if (count !== null) setTotalCount(count);
    if (error) console.error("Ledger Fetch Error:", error);
    setIsLoading(false);
  };

  useEffect(() => {
    if (userId) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, payment, sortBy, sortOrder, page, targetMonth, userId, isGlobalSearch]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortOrder === "asc" ? 
      <ArrowUp size={12} className="ml-1 text-primary" /> : 
      <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  const openDialog = (trx: Transaction) => {
    setSelectedTrx(trx);
    const form = JSON.parse(JSON.stringify(trx));
    form.transaction_timestamp = formatForInput(form.transaction_timestamp);
    setEditForm(form);
    setItemsToDelete([]);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleDeleteTransaction = async (trxId: string) => {
    if (!window.confirm("Warning: Are you sure you want to permanently delete this transaction and all its items?")) return;
    try {
      await supabase.from('transaction_items').delete().eq('transaction_id', trxId);
      const { error } = await supabase.from('transactions').delete().eq('id', trxId).eq('user_id', userId);
      if (error) throw error;
      setIsDialogOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete transaction. Please ensure you have valid access rights.");
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    const timestamp = new Date(editForm.transaction_timestamp);
    if (isNaN(timestamp.getTime())) {
      alert("Invalid transaction timestamp format!"); return;
    }
    setIsSaving(true);
    try {
      if (itemsToDelete.length > 0) {
        await supabase.from('transaction_items').delete().in('id', itemsToDelete);
      }
      const { error: trxError } = await supabase.from('transactions').update({
        type: editForm.type,
        transaction_timestamp: timestamp.toISOString(),
        location: editForm.location,
        merchant: editForm.merchant,
        category: editForm.category,
        payment_method: editForm.payment_method,
        subtotal: editForm.subtotal,
        tax_amount: editForm.tax_amount,
        admin_fee: editForm.admin_fee,
        total_amount: editForm.total_amount,
        financial_nature: editForm.financial_nature,
        is_fixed_cost: editForm.is_fixed_cost
      }).eq('id', editForm.id).eq('user_id', userId);

      if (trxError) throw trxError;

      const itemsToUpsert = editForm.transaction_items.map(item => ({
        id: item.id, 
        transaction_id: editForm.id,
        raw_name: item.raw_name,
        standard_name: item.standard_name,
        brand: item.brand,
        quantity: item.quantity,
        unit: item.unit,
        base_price: item.base_price,
        discount: item.discount,
        final_price: item.final_price
      }));

      if (itemsToUpsert.length > 0) {
        const { error: itemsError } = await supabase.from('transaction_items').upsert(itemsToUpsert);
        if (itemsError) throw itemsError;
      }
      setIsEditing(false);
      fetchTransactions();
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save changes. Please ensure data is valid.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItemFromForm = (itemId: string) => {
    if (!editForm) return;
    if (!itemId.startsWith('new-')) setItemsToDelete(prev => [...prev, itemId]);
    setEditForm({ ...editForm, transaction_items: editForm.transaction_items.filter(i => i.id !== itemId) });
  };

  const handleItemChange = (index: number, field: keyof TransactionItem, value: any) => {
    if (!editForm) return;
    const newItems = [...editForm.transaction_items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditForm({ ...editForm, transaction_items: newItems });
  };

  const handleAddNewItem = () => {
    if (!editForm) return;
    const newItem: TransactionItem = {
      id: crypto.randomUUID(), 
      transaction_id: editForm.id,
      raw_name: "New OCR Item", standard_name: "New Item", brand: "",
      quantity: 1, unit: "pcs", base_price: 0, discount: 0, final_price: 0
    };
    setEditForm({ ...editForm, transaction_items: [...editForm.transaction_items, newItem] });
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-3 md:space-y-6 bg-background">
      <header className="px-1 md:px-0">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="text-primary" size={22} /> Transaction Ledger
        </h2>
        <p className="text-muted-foreground text-[11px] md:text-sm">
          Historical ledger audit for {new Date(targetMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
      </header>

      {/* --- TOOLBAR --- */}
      <div className="mx-0 md:mx-0 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card p-2 md:p-3 rounded-xl border border-border shadow-sm">
         <div className="flex flex-1 flex-col md:flex-row gap-2 w-full items-stretch md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input 
              placeholder="Search merchant..." 
              className="h-9 md:h-10 pl-9 bg-background border-border text-xs md:text-sm"
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={category} onValueChange={(val) => { setCategory(val); setPage(1); }}>
            <SelectTrigger className="!h-9 md:!h-10 w-full md:w-48 text-xs md:text-sm bg-background border-border shadow-none">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Makanan & Minuman">Makanan & Minuman</SelectItem>
              <SelectItem value="Belanja Bulanan">Belanja Bulanan</SelectItem>
              <SelectItem value="Transportasi">Transportasi</SelectItem>
              <SelectItem value="Tagihan">Tagihan</SelectItem>
              <SelectItem value="Gaji">Gaji / Income</SelectItem>
              <SelectItem value="Lainnya">Lainnya</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 px-3 h-9 md:h-10 bg-background rounded-md border border-border w-full md:w-auto">
            <Switch 
              id="global-search" 
              checked={isGlobalSearch} 
              onCheckedChange={setIsGlobalSearch}
              size="sm"
            />
            <Label htmlFor="global-search" className="text-[10px] md:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Globe size={14} className={isGlobalSearch ? "text-primary" : "text-muted-foreground"} />
              Search All Periods
            </Label>
          </div>
        </div>
      </div>

      {/* --- TABLE (Optimized UI/UX) --- */}
      <Card className="mx-0 md:mx-0 shadow-sm border-border bg-card overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40 border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="w-[90px] md:w-[140px] text-[10px] md:text-xs font-semibold h-9 md:h-11 px-3 md:px-4 cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('transaction_timestamp')}
                >
                  <div className="flex items-center">Date <SortIcon column="transaction_timestamp" /></div>
                </TableHead>
                <TableHead 
                  className="text-[10px] md:text-xs font-semibold h-9 md:h-11 px-2 md:px-4 cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('merchant')}
                >
                  <div className="flex items-center">Merchant <SortIcon column="merchant" /></div>
                </TableHead>
                <TableHead 
                  className="hidden md:table-cell text-xs font-semibold h-11 px-4 cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">Category <SortIcon column="category" /></div>
                </TableHead>
                <TableHead 
                  className="text-right text-[10px] md:text-xs font-semibold h-9 md:h-11 px-3 md:px-4 cursor-pointer hover:text-primary transition-colors select-none"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center justify-end">Total <SortIcon column="total_amount" /></div>
                </TableHead>
                <TableHead className="text-center w-[50px] md:w-[100px] h-9 md:h-11"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-mono text-xs tracking-widest uppercase animate-pulse">Syncing Ledger...</TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 space-y-4">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <AlertCircle size={40} className="mb-2 opacity-20" />
                      <p className="text-xs md:text-sm font-medium">No transactions recorded in this period.</p>
                      {!isGlobalSearch && (
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="text-primary text-[11px] md:text-xs mt-2"
                          onClick={() => setIsGlobalSearch(true)}
                        >
                          Search through all history periods?
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : transactions.map((trx) => (
                  <TableRow key={trx.id} className="group border-border hover:bg-muted/30 transition-colors">
                    
                    <TableCell className="px-3 md:px-4 py-2.5 md:py-3">
                      <div className="flex flex-col justify-center">
                        <span className="text-[10px] md:text-xs font-medium text-foreground">
                          {formatDate(trx.transaction_timestamp).split(',')[0]}
                        </span>
                        <span className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5">
                          {formatDate(trx.transaction_timestamp).split(',')[1]?.trim()} WIB
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-2 md:px-4 py-2.5 md:py-3">
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                        <span className="font-semibold text-xs md:text-sm text-foreground max-w-[110px] md:max-w-[250px] truncate capitalize">
                          {trx.merchant}
                        </span>
                        {trx.type === 'income' && (
                          <Badge variant="outline" className="w-fit text-[8px] font-bold h-4 px-1.5 border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-400">
                            INCOME
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell px-4 py-3">
                      <Badge variant="secondary" className="font-medium text-[10px] text-muted-foreground bg-muted/50 hover:bg-muted capitalize">
                        {trx.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right px-3 md:px-4 py-2.5 md:py-3">
                      <div className={`font-mono font-bold text-[11px] md:text-sm whitespace-nowrap ${trx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        {trx.type === 'income' ? '+ ' : ''}{formatIDR(trx.total_amount)}
                      </div>
                    </TableCell>

                    <TableCell className="text-center px-1 md:px-4 py-2.5 md:py-3 align-middle">
                      <Button 
                        onClick={() => openDialog(trx)} 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 md:h-8 md:w-auto md:px-3 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Audit Transaction"
                      >
                        <span className="hidden md:inline text-[10px] font-bold tracking-wider">AUDIT</span>
                        <Edit3 size={14} className="md:hidden" />
                      </Button>
                    </TableCell>

                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- PAGINATION --- */}
      <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 md:gap-3 pb-20 md:pb-0 pt-4 px-4 md:px-0">
         <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8 rounded-lg" onClick={() => setPage(1)} disabled={page === 1 || totalPages === 0}><ChevronsLeft size={18} className="md:w-4 md:h-4" /></Button>
         <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8 rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || totalPages === 0}><ChevronLeft size={18} className="md:w-4 md:h-4" /></Button>
         <div className="flex items-center justify-center min-w-[80px] bg-muted/30 h-10 md:h-8 rounded-lg border border-border px-3"><span className="text-xs md:text-sm font-semibold text-foreground">{page} <span className="text-muted-foreground mx-0.5">/</span> {totalPages || 1}</span></div>
         <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8 rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || totalPages === 0}><ChevronRight size={18} className="md:w-4 md:h-4" /></Button>
         <Button variant="outline" size="icon" className="h-10 w-10 md:h-8 md:w-8 rounded-lg" onClick={() => setPage(totalPages)} disabled={page >= totalPages || totalPages === 0}><ChevronsRight size={18} className="md:w-4 md:h-4" /></Button>
      </div>

      {/* --- FULL SCHEMA DIALOG MODAL --- */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) setIsDialogOpen(false) }}>
        <DialogContent className="sm:max-w-[900px] w-full md:w-[95vw] h-full md:h-[96vh] md:max-h-[96vh] flex flex-col bg-card border-border p-0 overflow-hidden rounded-none md:rounded-2xl">
          {editForm && (
            <>
              {/* HEADER */}
              <div className="p-4 md:p-6 pb-3 md:pb-4 border-b border-border bg-muted/10 shrink-0">
                <div className="flex justify-between items-start">
                  <div className="pr-8 md:pr-0">
                    <DialogTitle className="text-base md:text-xl flex items-center gap-2">
                      {isEditing ? <Edit3 size={16} className="text-primary"/> : <FileText size={16} className="text-primary"/>}
                      {isEditing ? "Edit Audit Data" : "Database Record"}
                    </DialogTitle>
                    <DialogDescription className="font-mono text-[8px] md:text-[10px] mt-0.5 truncate max-w-[180px] md:max-w-none text-muted-foreground/70">ID: {editForm.id}</DialogDescription>
                  </div>
                  {!isEditing && (
                    <div className="hidden md:flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}><Edit3 size={14} className="mr-1" /> Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteTransaction(editForm.id)}><Trash2 size={14} className="mr-1" /> Delete</Button>
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex md:hidden gap-2 mt-2">
                    <Button variant="outline" size="xs" className="flex-1 h-7 text-[9px] font-bold" onClick={() => setIsEditing(true)}><Edit3 size={10} className="mr-1" /> Edit Mode</Button>
                    <Button variant="destructive" size="xs" className="flex-1 h-7 text-[9px] font-bold" onClick={() => handleDeleteTransaction(editForm.id)}><Trash2 size={10} className="mr-1" /> Delete</Button>
                  </div>
                )}
              </div>

              {/* BODY */}
              <div className="flex-1 min-h-0 overflow-hidden relative">
                <ScrollArea className="h-full w-full absolute inset-0">
                  <div className="p-3 md:p-6">
                    {isEditing ? (
                      <div className="space-y-5 md:space-y-8 pb-4">
                        {/* Identitas Penuh */}
                        <div className="space-y-2 md:space-y-4">
                          <h3 className="text-[10px] md:text-sm font-bold border-b border-border pb-1 uppercase tracking-wider text-muted-foreground">1. Transaction Identity</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Merchant</Label><Input className="h-8 md:h-10 text-xs" value={editForm.merchant} onChange={(e) => setEditForm({...editForm, merchant: e.target.value})} /></div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Timestamp</Label><Input type="datetime-local" className="h-8 md:h-10 text-xs" value={editForm.transaction_timestamp} onChange={(e) => setEditForm({...editForm, transaction_timestamp: e.target.value})} /></div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Type</Label>
                              <Select value={editForm.type} onValueChange={(v) => setEditForm({...editForm, type: v})}>
                                <SelectTrigger className="h-8 md:h-10 text-xs"><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Category</Label><Input className="h-8 md:h-10 text-xs" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})} /></div>
                            
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Location</Label><Input className="h-8 md:h-10 text-xs" value={editForm.location || ''} onChange={(e) => setEditForm({...editForm, location: e.target.value})} /></div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Payment Method</Label><Input className="h-8 md:h-10 text-xs" value={editForm.payment_method || ''} onChange={(e) => setEditForm({...editForm, payment_method: e.target.value})} /></div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Fin. Nature</Label>
                              <Select value={editForm.financial_nature || 'need'} onValueChange={(v) => setEditForm({...editForm, financial_nature: v})}>
                                <SelectTrigger className="h-8 md:h-10 text-xs"><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="need">Need</SelectItem><SelectItem value="want">Want</SelectItem><SelectItem value="saving">Saving</SelectItem><SelectItem value="capex">Capex</SelectItem></SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1"><Label className="text-[9px] md:text-xs text-muted-foreground">Fixed Cost?</Label>
                              <Select value={editForm.is_fixed_cost ? "true" : "false"} onValueChange={(v) => setEditForm({...editForm, is_fixed_cost: v === "true"})}>
                                <SelectTrigger className="h-8 md:h-10 text-xs"><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="true">YES (Fixed)</SelectItem><SelectItem value="false">NO (Variable)</SelectItem></SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        {/* Rincian Biaya */}
                        <div className="space-y-2 md:space-y-4">
                          <h3 className="text-[10px] md:text-sm font-bold border-b border-border pb-1 uppercase tracking-wider text-muted-foreground">2. Cost Aggregation</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            <div className="space-y-1"><Label className="text-[8px] md:text-[10px]">Subtotal</Label><Input type="number" className="h-8 md:h-9 font-mono text-xs" value={editForm.subtotal || 0} onChange={(e) => setEditForm({...editForm, subtotal: Number(e.target.value)})} /></div>
                            <div className="space-y-1"><Label className="text-[8px] md:text-[10px]">Tax</Label><Input type="number" className="h-8 md:h-9 font-mono text-xs" value={editForm.tax_amount || 0} onChange={(e) => setEditForm({...editForm, tax_amount: Number(e.target.value)})} /></div>
                            <div className="space-y-1"><Label className="text-[8px] md:text-[10px]">Admin Fee</Label><Input type="number" className="h-8 md:h-9 font-mono text-xs" value={editForm.admin_fee || 0} onChange={(e) => setEditForm({...editForm, admin_fee: Number(e.target.value)})} /></div>
                            <div className="space-y-1"><Label className="text-[8px] md:text-[10px] text-primary font-bold">TOTAL AMOUNT</Label><Input type="number" className="h-8 md:h-9 font-mono text-xs font-bold border-primary/50 bg-primary/5" value={editForm.total_amount} onChange={(e) => setEditForm({...editForm, total_amount: Number(e.target.value)})} /></div>
                          </div>
                        </div>

                        {/* Audit Item Lengkap */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center border-b border-border pb-1">
                            <h3 className="text-[10px] md:text-sm font-bold uppercase tracking-wider text-muted-foreground">3. Database Items Detail</h3>
                            <Button variant="outline" size="xs" className="h-6 text-[8px] md:text-[10px] text-primary border-primary/50" onClick={handleAddNewItem}><PlusCircle size={10} className="mr-1"/> Add Item</Button>
                          </div>
                          <div className="space-y-3 md:space-y-4">
                            {editForm.transaction_items.map((item, idx) => (
                              <Card key={item.id} className="p-3 md:p-4 bg-muted/10 border-border/50 relative">
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-destructive" onClick={() => handleRemoveItemFromForm(item.id)}><X size={14} /></Button>
                                
                                <div className="flex flex-col gap-2 md:gap-3 pr-6">
                                  {/* Baris 1: Teks */}
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px] text-muted-foreground">Raw Name (OCR)</Label><Input className="h-7 md:h-8 text-[10px] md:text-xs" value={item.raw_name} onChange={(e) => handleItemChange(idx, 'raw_name', e.target.value)} /></div>
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px] font-bold">Standard Name</Label><Input className="h-7 md:h-8 text-[10px] md:text-xs bg-background" value={item.standard_name} onChange={(e) => handleItemChange(idx, 'standard_name', e.target.value)} /></div>
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px] text-muted-foreground">Brand</Label><Input className="h-7 md:h-8 text-[10px] md:text-xs" value={item.brand || ''} onChange={(e) => handleItemChange(idx, 'brand', e.target.value)} /></div>
                                  </div>
                                  
                                  {/* Baris 2: Numerik */}
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px]">Qty</Label><Input type="number" className="h-7 md:h-8 text-[10px] md:text-xs font-mono" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))} /></div>
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px]">Unit</Label><Input className="h-7 md:h-8 text-[10px] md:text-xs" value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} /></div>
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px]">Base Price</Label><Input type="number" className="h-7 md:h-8 text-[10px] md:text-xs font-mono" value={item.base_price} onChange={(e) => handleItemChange(idx, 'base_price', Number(e.target.value))} /></div>
                                    <div className="space-y-0.5"><Label className="text-[8px] md:text-[10px] text-muted-foreground">Discount</Label><Input type="number" className="h-7 md:h-8 text-[10px] md:text-xs font-mono" value={item.discount} onChange={(e) => handleItemChange(idx, 'discount', Number(e.target.value))} /></div>
                                    <div className="space-y-0.5 col-span-2 md:col-span-1"><Label className="text-[8px] md:text-[10px] text-primary">Final Price</Label><Input type="number" className="h-7 md:h-8 text-[10px] md:text-xs font-mono font-bold border-primary/50 bg-primary/5" value={item.final_price} onChange={(e) => handleItemChange(idx, 'final_price', Number(e.target.value))} /></div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 md:space-y-6 pb-4">
                        {/* Identitas View Mode */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 bg-muted/10 p-3 md:p-5 rounded-xl border border-border shadow-inner">
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Type</p><Badge variant={editForm.type === 'income' ? 'default' : 'destructive'} className={`text-[9px] md:text-[10px] font-bold h-5 px-1.5 ${editForm.type==='income' ? 'bg-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-none' : ''}`}>{editForm.type.toUpperCase()}</Badge></div>
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Category</p><Badge variant="outline" className="text-[9px] md:text-[10px] font-bold bg-background h-5 px-1.5 capitalize">{editForm.category}</Badge></div>
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Method</p><p className="font-bold text-[10px] md:text-sm truncate capitalize">{editForm.payment_method || '-'}</p></div>
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Location</p><p className="font-bold text-[10px] md:text-sm truncate flex items-center gap-1 capitalize"><MapPin size={12} className="text-muted-foreground"/> {editForm.location || '-'}</p></div>
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Nature</p><p className="font-bold text-[10px] md:text-sm capitalize">{editForm.financial_nature || '-'}</p></div>
                            <div><p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Fixed Cost</p><Badge variant={editForm.is_fixed_cost ? "default" : "secondary"} className="text-[8px] md:text-[9px] font-bold h-4 md:h-5">{editForm.is_fixed_cost ? 'YES' : 'NO'}</Badge></div>
                        </div>

                        {/* Rincian Item View Mode */}
                        <div className="space-y-2">
                          <h4 className="text-[9px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border pb-1 flex justify-between"><span>Item Breakdown</span><span className="text-primary">{editForm.transaction_items.length} Items</span></h4>
                          <div className="space-y-1.5 md:space-y-3">
                            {editForm.transaction_items?.map((item) => (
                              <div key={item.id} className="flex justify-between items-center p-2.5 md:p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors gap-2 md:gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-foreground text-xs md:text-base truncate capitalize">{item.standard_name} {item.brand && <span className="font-normal text-muted-foreground">({item.brand})</span>}</p>
                                  <p className="font-mono text-[8px] md:text-[10px] text-muted-foreground/70 truncate mt-0.5">ocr: {item.raw_name}</p>
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <Badge variant="secondary" className="font-mono text-[8px] md:text-[10px] bg-background h-4 px-1">{item.quantity} {item.unit}</Badge>
                                    <span className="text-[9px] md:text-xs font-mono text-muted-foreground whitespace-nowrap">@ {formatIDR(item.base_price)}</span>
                                    {item.discount > 0 && <span className="text-[8px] md:text-[10px] font-mono text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20 px-1 rounded">-{formatIDR(item.discount)}</span>}
                                  </div>
                                </div>
                                <span className="font-mono font-black text-xs md:text-lg text-primary whitespace-nowrap">{formatIDR(item.final_price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* FOOTER */}
              {isEditing ? (
                <div className="p-3 md:p-4 border-t border-border bg-muted/10 shrink-0 flex justify-end gap-2 z-10">
                  <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" className="h-8 text-xs px-4 bg-primary text-primary-foreground font-bold flex-1 md:flex-none" onClick={handleSaveEdit} disabled={isSaving}>{isSaving ? "Saving..." : <><Save size={12} className="mr-1.5" /> Save Changes</>}</Button>
                </div>
              ) : (
                <div className="p-3 md:p-6 border-t border-border bg-card shrink-0 flex justify-between items-center z-10">
                   <div className="flex flex-col"><span className="text-[9px] md:text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Grand Total</span></div>
                   <span className={`text-lg md:text-3xl font-black font-mono drop-shadow-sm ${editForm.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'}`}>{formatIDR(editForm.total_amount)}</span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}