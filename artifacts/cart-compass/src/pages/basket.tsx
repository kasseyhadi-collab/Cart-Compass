import React, { useMemo } from "react";
import { Layout } from "@/components/layout";
import { useBasket } from "@/lib/basket-context";
import { useListProducts, useCompareBasket } from "@workspace/api-client-react";
import { Minus, Plus, Trash2, ShoppingBasket, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";

export default function BasketPage() {
  const [, setLocation] = useLocation();
  const { items, updateQuantity, removeItem, totalItems } = useBasket();
  
  // We need to fetch product details to display names, 
  // alternatively we could have stored product details in context.
  // The API allows us to fetch products and we can filter locally for now.
  const { data: allProducts, isLoading: isLoadingProducts } = useListProducts(undefined, { query: { enabled: items.length > 0 } });

  const compareMutation = useCompareBasket();

  const basketProducts = useMemo(() => {
    if (!allProducts) return [];
    return items.map(item => {
      const product = allProducts.find(p => p.id === item.productId);
      return {
        ...item,
        product
      };
    }).filter(i => i.product); // Only show items where product was found
  }, [items, allProducts]);

  const handleCompare = () => {
    compareMutation.mutate({
      data: {
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      }
    }, {
      onSuccess: (result) => {
        // We could pass data via state or just refetch on the results page using a shared mutation/query
        // Since mutation result isn't easily shared via wouter, we might store it in context,
        // or we could use the history state. 
        // For simplicity, let's navigate to results and we'll use a trick or context to pass data.
        // Actually, we can just save it to sessionStorage or use a state manager.
        sessionStorage.setItem("lastComparison", JSON.stringify({ result, basketItems: items, basketProducts }));
        setLocation("/results");
      }
    });
  };

  return (
    <Layout>
      <div className="px-6 py-6 pb-32">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Your Basket</h1>
        
        {items.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-3xl border border-border shadow-sm px-6">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBasket className="text-primary" size={32} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Your basket is empty</h2>
            <p className="text-muted-foreground mb-8">Add items to compare prices across stores and find the best deals.</p>
            <Link href="/products">
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90 rounded-xl h-14 text-base font-semibold shadow-md">
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : isLoadingProducts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {basketProducts.map(({ product, quantity, productId }) => (
              <div key={productId} className="bg-card border border-border p-4 rounded-2xl flex flex-col shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <h4 className="font-bold text-foreground leading-tight">{product?.name}</h4>
                    <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wider">{product?.category}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeItem(productId)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 -mt-1 -mr-1"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
                
                <div className="flex items-center gap-4 mt-auto">
                  <div className="flex items-center bg-accent rounded-xl p-1 border border-border/50">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => updateQuantity(productId, quantity - 1)}
                      className="h-10 w-10 rounded-lg hover:bg-background shadow-sm bg-background"
                    >
                      <Minus size={18} />
                    </Button>
                    <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => updateQuantity(productId, quantity + 1)}
                      className="h-10 w-10 rounded-lg hover:bg-background shadow-sm bg-background"
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-[72px] left-0 w-full max-w-[430px] left-1/2 -translate-x-1/2 p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
          <Button 
            size="lg" 
            className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-2xl h-16 text-lg font-bold shadow-xl shadow-foreground/20 flex items-center justify-center gap-2"
            onClick={handleCompare}
            disabled={compareMutation.isPending}
          >
            {compareMutation.isPending ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Compare {totalItems} {totalItems === 1 ? 'Item' : 'Items'} <ArrowRight size={20} />
              </>
            )}
          </Button>
        </div>
      )}
    </Layout>
  );
}
