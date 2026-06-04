import React, { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
import { useBasket } from "@/lib/basket-context";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSearch } from "wouter";

export default function ProductsPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") || "";

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const { addItem, items } = useBasket();

  const { data: categories } = useListCategories();
  
  const queryParams = useMemo(() => {
    const params: any = {};
    if (search.trim()) params.search = search.trim();
    if (selectedCategory) params.category = selectedCategory;
    return params;
  }, [search, selectedCategory]);

  const { data: products, isLoading } = useListProducts(queryParams, { query: { enabled: true } });

  return (
    <Layout>
      <div className="px-6 py-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Find Products</h1>
        
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input 
            className="pl-11 h-14 rounded-2xl bg-card border-border shadow-sm text-base"
            placeholder="Search groceries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <ScrollArea className="w-full whitespace-nowrap px-6 pb-4">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className={cn(
                "rounded-xl h-10 px-5 font-semibold transition-all border",
                selectedCategory === "" 
                  ? "bg-foreground text-background border-foreground hover:bg-foreground hover:text-background" 
                  : "bg-card text-foreground hover:bg-accent border-border"
              )}
              onClick={() => setSelectedCategory("")}
            >
              All
            </Button>
            {categories?.map((cat) => (
              <Button
                key={cat.name}
                variant="outline"
                className={cn(
                  "rounded-xl h-10 px-5 font-semibold transition-all border",
                  selectedCategory === cat.name 
                    ? "bg-foreground text-background border-foreground hover:bg-foreground hover:text-background" 
                    : "bg-card text-foreground hover:bg-accent border-border"
                )}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      <div className="px-6 pb-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border border-dashed">
            <div className="bg-accent/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-muted-foreground" size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">No products found</h3>
            <p className="text-muted-foreground text-sm">Try a different search term or category.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {products?.map((product) => {
              const basketItem = items.find(i => i.productId === product.id);
              const inBasket = !!basketItem;

              return (
                <div key={product.id} className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex-1 mr-4">
                    <h4 className="font-bold text-foreground leading-tight">{product.name}</h4>
                    <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wider">{product.category}</p>
                    {(product.brand || product.packageSize) && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {[product.brand, product.packageSize].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={() => addItem(product.id)}
                    variant={inBasket ? "secondary" : "default"}
                    size="icon"
                    className={cn(
                      "h-12 w-12 rounded-xl shrink-0 transition-all",
                      inBasket ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    )}
                  >
                    {inBasket ? (
                      <span className="font-bold text-lg">{basketItem.quantity}</span>
                    ) : (
                      <Plus size={24} strokeWidth={2.5} />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
