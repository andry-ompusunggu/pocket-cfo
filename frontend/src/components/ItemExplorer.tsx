import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, PackageSearch, ArrowUpDown, Store } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIDR, formatDate } from '@/lib/formatters';

// --- Types ---
interface ItemRecord {
  item_id: string;
  transaction_timestamp: string;
  merchant: string;
  raw_name: string;
  standard_name: string;
  quantity: number;
  unit: string;
  base_price: number;
  discount: number;
  final_price: number;
}

export default function ItemExplorer() {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Local States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("transaction_timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchItems();
    }, 400); 

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy, sortOrder]);

  const fetchItems = async () => {
    setIsLoading(true);
    let query = supabase
      .from('vw_item_explorer')
      .select('*')
      .order(sortBy, { ascending: sortOrder === "asc" })
      .limit(100); 

    if (searchQuery) {
      query = query.or(`raw_name.ilike.%${searchQuery}%,standard_name.ilike.%${searchQuery}%,merchant.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (data) setItems(data);
    if (error) {
      console.error("Explorer Fetch Error:", error);
    }
    setIsLoading(false);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <div className="p-0 md:p-8 max-w-7xl mx-auto space-y-3 md:space-y-6 bg-background">
      <header className="px-1 md:px-0">
        <h2 className="text-lg md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <PackageSearch className="text-primary" size={22} /> 
          Database Explorer
        </h2>
        <p className="text-muted-foreground text-[11px] md:text-sm">Search and analyze historical transaction items.</p>
      </header>

      {/* --- SEARCH BAR --- */}
      <div className="mx-0 md:mx-0 bg-card p-2 md:p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-2 md:gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={14} />
          <Input 
            placeholder="Search item name, merchant, etc..." 
            className="pl-9 h-9 md:h-11 bg-background border-border text-foreground focus-visible:ring-primary text-xs md:text-sm rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-[10px] md:text-sm font-medium text-muted-foreground w-full md:w-auto text-left md:text-right px-1">
          Showing <span className="text-foreground font-bold">{items.length}</span> items
        </div>
      </div>

      {/* --- DATA TABLE --- */}
      <Card className="mx-0 md:mx-0 shadow-sm border-border bg-card overflow-hidden">
        <CardContent className="p-0 overflow-x-hidden">
          <Table>
            {/* Header with blended background color (secondary/50) */}
            <TableHeader className="bg-secondary/50 border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[85px] md:w-[140px] px-2 md:px-4 h-9 md:h-11">
                  <Button variant="ghost" size="sm" className="h-7 md:h-8 px-1 -ml-1 text-[10px] md:text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort('transaction_timestamp')}>
                    Date <ArrowUpDown size={12} className="ml-1.5 opacity-50" />
                  </Button>
                </TableHead>
                {/* Merchant Column HIDDEN on Mobile */}
                <TableHead className="hidden md:table-cell w-auto px-4 h-11">
                  <Button variant="ghost" size="sm" className="h-8 px-1 -ml-1 text-xs font-semibold text-muted-foreground hover:text-foreground" onClick={() => handleSort('merchant')}>
                    Merchant <ArrowUpDown size={12} className="ml-1.5 opacity-50" />
                  </Button>
                </TableHead>
                <TableHead className="text-muted-foreground px-2 md:px-4 text-[10px] md:text-xs font-semibold min-w-[140px] h-9 md:h-11">
                  Item Details
                </TableHead>
                <TableHead className="text-right px-2 md:px-4 h-9 md:h-11">
                  <Button variant="ghost" size="sm" className="h-7 md:h-8 px-1 -mr-1 text-[10px] md:text-xs font-semibold text-muted-foreground hover:text-foreground float-right" onClick={() => handleSort('final_price')}>
                    Total <ArrowUpDown size={12} className="ml-1.5 opacity-50" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground font-mono text-xs tracking-widest uppercase animate-pulse">SCANNING DATABASE...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-xs">No items found.</TableCell></TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.item_id} className="border-border hover:bg-muted/30 transition-colors">
                    
                    {/* Timestamp Column (Stacked) */}
                    <TableCell className="px-2.5 md:px-4 py-2.5 md:py-3 align-top md:align-middle">
                      <div className="flex flex-col justify-start mt-0.5 md:mt-0">
                        <span className="text-[10px] md:text-xs font-medium text-foreground whitespace-nowrap">
                          {formatDate(item.transaction_timestamp).split(',')[0]}
                        </span>
                        <span className="text-[8px] md:text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                          {formatDate(item.transaction_timestamp).split(',')[1]?.trim()} WIB
                        </span>
                      </div>
                    </TableCell>
                    
                    {/* Merchant Column (HIDDEN on Mobile) */}
                    <TableCell className="hidden md:table-cell px-4 py-3">
                      <div className="font-semibold text-sm text-foreground max-w-[200px] truncate capitalize">
                        {item.merchant}
                      </div>
                    </TableCell>
                    
                    {/* Item Details Column (Smart: Shows Merchant on Mobile) */}
                    <TableCell className="px-2 md:px-4 py-2.5 md:py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-foreground text-[11px] md:text-sm leading-tight capitalize">
                          {item.standard_name}
                        </span>
                        
                        {/* Mobile display fallback for merchant name */}
                        <div className="md:hidden flex items-center gap-1 text-muted-foreground text-[9px] font-bold uppercase tracking-tight">
                           <Store size={10} className="text-primary/50" />
                           <span className="truncate max-w-[120px]">{item.merchant}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 font-mono">
                          <Badge variant="outline" className="h-4 px-1 text-[8px] md:text-[9px] font-bold border-border bg-muted/30">
                            {item.quantity} {item.unit}
                          </Badge>
                          <span className="text-[9px] md:text-xs text-muted-foreground/80">
                            @ {formatIDR(item.base_price)}
                          </span>
                          {item.discount > 0 && (
                            <span className="text-[8px] md:text-[10px] text-emerald-600 bg-emerald-500/10 px-1 rounded">
                              -{formatIDR(item.discount)}
                            </span>
                          )}
                        </div>
                        <p className="text-[8px] md:text-[10px] text-muted-foreground/60 italic mt-1 truncate max-w-[180px] md:max-w-none">
                          ocr: {item.raw_name}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="px-2.5 md:px-4 py-2.5 md:py-3 align-top md:align-middle">
                      <div className="font-mono font-bold text-[10px] md:text-sm text-foreground whitespace-nowrap mt-0.5 md:mt-0">
                        {formatIDR(item.final_price)}
                      </div>
                    </TableCell>

                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Mobile Spacer (prevents bottom navbar overlap) */}
      <div className="h-24 md:hidden"></div>
    </div>
  );
}