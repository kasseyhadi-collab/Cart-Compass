import React, { useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { ComparisonResult, Product, BasketItem } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, ChevronLeft, Store, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResultsPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<{
    result: ComparisonResult;
    basketItems: BasketItem[];
    basketProducts: { productId: number; quantity: number; product: Product }[];
  } | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("lastComparison");
    if (saved) {
      setData(JSON.parse(saved));
    } else {
      setLocation("/basket");
    }
  }, [setLocation]);

  if (!data) return <Layout><div className="p-8">Loading...</div></Layout>;

  const { result, basketProducts } = data;
  
  // Sort store totals low to high
  const sortedStores = [...result.storeTotals].sort((a, b) => a.total - b.total);

  return (
    <Layout>
      <div className="px-6 py-6 pb-8 bg-primary/5 min-h-screen">
        <Link href="/basket">
          <Button variant="ghost" className="mb-6 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
            <ChevronLeft size={20} className="mr-1" />
            <span className="font-semibold">Back to Basket</span>
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Comparison Results</h1>

        {/* Winner Card */}
        <Card className="p-6 mb-8 bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-white/20 p-2 rounded-xl">
                <Trophy size={20} className="text-yellow-300" />
              </div>
              <span className="font-bold tracking-wide uppercase text-xs text-primary-foreground/90">Best Store This Week</span>
            </div>
            
            <h2 className="text-4xl font-extrabold mb-2">{result.winnerName}</h2>
            
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold">${result.winnerTotal.toFixed(2)}</span>
              <span className="text-primary-foreground/70 font-medium">total</span>
            </div>
            
            <div className="bg-white/10 rounded-xl p-3 inline-block backdrop-blur-sm">
              <p className="font-semibold text-sm">
                You Save: <span className="text-yellow-300 ml-1 font-bold text-lg">${result.savings.toFixed(2)}</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Store Comparison */}
        <h3 className="text-lg font-bold text-foreground mb-4">Store Comparison</h3>
        <div className="flex flex-col gap-3 mb-8">
          {sortedStores.map((store, index) => (
            <div 
              key={store.storeId} 
              className={cn(
                "bg-card border p-4 rounded-2xl flex items-center justify-between shadow-sm",
                store.storeId === result.winnerId ? "border-primary shadow-primary/5" : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  store.storeId === result.winnerId ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"
                )}>
                  <Store size={20} />
                </div>
                <span className="font-bold text-foreground">{store.storeName}</span>
              </div>
              <span className="font-bold text-lg">${store.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Item Savings */}
        {result.itemSavings.length > 0 && (
          <>
            <h3 className="text-lg font-bold text-foreground mb-4">Where you saved the most</h3>
            <div className="flex flex-col gap-3">
              {result.itemSavings
                .sort((a, b) => b.savings - a.savings)
                .slice(0, 5) // Top 5 savings
                .map((itemSave) => (
                <div key={itemSave.productId} className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 text-green-600 rounded-xl flex items-center justify-center">
                      <Tag size={18} />
                    </div>
                    <span className="font-semibold text-foreground">{itemSave.productName}</span>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-green-600">-${itemSave.savings.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
