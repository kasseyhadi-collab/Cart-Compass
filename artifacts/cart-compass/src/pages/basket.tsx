import React, { useMemo } from "react";
import { Layout } from "@/components/layout";
import { useBasket } from "@/lib/basket-context";
import { useListProducts, useCompareBasket, getListProductsQueryKey } from "@workspace/api-client-react";
import { Minus, Plus, Trash2, ShoppingBasket, ArrowRight, Loader2, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, Link } from "wouter";

export default function BasketPage() {
  const [, setLocation] = useLocation();
  const { items, updateQuantity, removeItem, totalItems } = useBasket();

  const { data: allProducts, isLoading: isLoadingProducts } = useListProducts(
    undefined,
    { query: { queryKey: getListProductsQueryKey(), enabled: items.length > 0 } }
  );

  const compareMutation = useCompareBasket();
  const isComparing = compareMutation.isPending;

  const basketProducts = useMemo(() => {
    if (!allProducts) return [];
    return items
      .map((item) => {
        const product = allProducts.find((p) => p.id === item.productId);
        return { ...item, product };
      })
      .filter((i) => i.product);
  }, [items, allProducts]);

  const handleCompare = () => {
    compareMutation.mutate(
      { data: { items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) } },
      {
        onSuccess: (result) => {
          sessionStorage.setItem(
            "lastComparison",
            JSON.stringify({ result, basketItems: items, basketProducts })
          );
          setLocation("/results");
        },
      }
    );
  };

  return (
    <Layout>
      {/* Comparison loading overlay */}
      {isComparing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="bg-card border border-border rounded-3xl shadow-xl px-8 py-8 flex flex-col items-center gap-4 mx-6 max-w-xs w-full">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShoppingBasket size={22} className="text-primary" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground text-base">Comparing stores…</p>
              <p className="text-muted-foreground text-sm mt-1">
                Checking prices across Phoenix stores
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-6 pb-32">
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Your Basket</h1>

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border shadow-sm px-6">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
              <ShoppingBasket className="text-primary" size={32} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Your basket is empty</h2>
            <p className="text-muted-foreground text-sm mb-1 leading-relaxed">
              Add items from your weekly grocery list and we'll calculate your total at each store — so you always shop at the cheapest one.
            </p>
            <p className="text-xs text-muted-foreground/70 mb-7">
              No account needed. Prices are updated regularly for Phoenix, AZ stores.
            </p>
            <Link href="/products">
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 rounded-xl h-14 text-base font-semibold shadow-md"
              >
                Browse Products
              </Button>
            </Link>
            <Link href="/products">
              <button className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                Or search by category →
              </button>
            </Link>
          </div>
        ) : isLoadingProducts ? (
          /* Loading product names */
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-primary" size={28} />
            <p className="text-sm text-muted-foreground">Loading your basket…</p>
          </div>
        ) : basketProducts.length === 0 ? (
          /* Products added but none resolved (edge case) */
          <div className="text-center py-12 bg-card rounded-3xl border border-border px-6">
            <PackageSearch className="text-muted-foreground mx-auto mb-4" size={40} />
            <p className="font-semibold text-foreground mb-1">Products not found</p>
            <p className="text-sm text-muted-foreground">
              Some items in your basket could not be loaded. Try removing them and adding again.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Item count summary */}
            <p className="text-sm text-muted-foreground font-medium">
              {totalItems} {totalItems === 1 ? "item" : "items"} in your basket
            </p>

            {basketProducts.map(({ product, quantity, productId }) => (
              <div
                key={productId}
                className="bg-card border border-border p-4 rounded-2xl flex flex-col shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 mr-4">
                    <h4 className="font-bold text-foreground leading-tight">{product?.name}</h4>
                    <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-wider">
                      {product?.category}
                      {product?.packageSize && (
                        <span className="normal-case tracking-normal ml-2 text-muted-foreground/60">· {product.packageSize}</span>
                      )}
                    </p>
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
                  <p className="text-xs text-muted-foreground">
                    {quantity > 1 ? `${quantity} × 1 unit` : "1 unit"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compare CTA — fixed above nav */}
      {items.length > 0 && (
        <div className="fixed bottom-[72px] left-0 w-full max-w-[430px] left-1/2 -translate-x-1/2 p-4 bg-gradient-to-t from-background via-background to-transparent z-40">
          <Button
            size="lg"
            className="w-full bg-foreground hover:bg-foreground/90 text-background rounded-2xl h-16 text-lg font-bold shadow-xl shadow-foreground/20 flex items-center justify-center gap-2"
            onClick={handleCompare}
            disabled={isComparing}
          >
            <>
              Compare {totalItems} {totalItems === 1 ? "Item" : "Items"}
              <ArrowRight size={20} />
            </>
          </Button>
        </div>
      )}
    </Layout>
  );
}
