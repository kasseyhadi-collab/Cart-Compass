import React from "react";
import { Link } from "wouter";
import { useBasket } from "@/lib/basket-context";
import { Compass, ShoppingCart, Search, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { totalItems } = useBasket();

  return (
    <div className="mx-auto max-w-[430px] min-h-[100dvh] bg-background shadow-2xl relative flex flex-col sm:border-x border-border">
      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 w-full max-w-[430px] bg-card border-t border-border z-50 rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around p-3">
          <Link href="/">
            <div className={cn("flex flex-col items-center gap-1 cursor-pointer transition-colors p-2 rounded-xl", location === "/" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              <Home size={22} strokeWidth={location === "/" ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">Home</span>
            </div>
          </Link>

          <Link href="/products">
            <div className={cn("flex flex-col items-center gap-1 cursor-pointer transition-colors p-2 rounded-xl", location === "/products" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              <Search size={22} strokeWidth={location === "/products" ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">Search</span>
            </div>
          </Link>

          <Link href="/basket">
            <div className={cn("flex flex-col items-center gap-1 cursor-pointer transition-colors p-2 rounded-xl relative", location === "/basket" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              <div className="relative">
                <ShoppingCart size={22} strokeWidth={location === "/basket" ? 2.5 : 2} />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm animate-in zoom-in">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">Basket</span>
            </div>
          </Link>
        </div>
      </nav>
    </div>
  );
}
