import React from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useBasket } from "@/lib/basket-context";
import { Compass, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useListCategories } from "@workspace/api-client-react";

export default function HomePage() {
  const { totalItems } = useBasket();
  const { data: categories, isLoading } = useListCategories();

  return (
    <Layout>
      <div className="px-6 py-8">
        <header className="flex items-center gap-3 mb-10">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl">
            <Compass size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">CartCompass</h1>
            <p className="text-sm text-muted-foreground font-medium">Smart savings, simple shopping.</p>
          </div>
        </header>

        <Card className="p-6 mb-8 bg-foreground text-background border-none shadow-xl relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative z-10">
            <h2 className="text-lg font-medium text-background/80 mb-1">Your Basket</h2>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-extrabold tracking-tighter">{totalItems}</span>
              <span className="text-background/60 font-medium">items</span>
            </div>
            
            <Link href="/products">
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-14 text-base shadow-lg shadow-primary/20 transition-all">
                Add Items
              </Button>
            </Link>
          </div>
        </Card>

        <div className="mb-8">
          <Link href="/products">
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 cursor-pointer shadow-sm hover:border-primary/30 transition-colors">
              <Search className="text-muted-foreground" size={20} />
              <span className="text-muted-foreground font-medium">Search for groceries...</span>
            </div>
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">Browse Categories</h3>
            <Link href="/products">
              <span className="text-sm font-semibold text-primary flex items-center cursor-pointer">
                See all <ChevronRight size={16} />
              </span>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-card rounded-2xl border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {categories?.slice(0, 6).map((cat) => (
                <Link key={cat.name} href={`/products?category=${encodeURIComponent(cat.name)}`}>
                  <Card className="p-4 flex flex-col justify-center h-24 hover:border-primary cursor-pointer transition-colors group shadow-sm rounded-2xl">
                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{cat.name}</span>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
